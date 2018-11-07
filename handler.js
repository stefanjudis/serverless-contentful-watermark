'use strict';

const Jimp = require('jimp');
const get = require('got');
const contentful = require('contentful-management');
const { Duplex } = require('stream');

const {
  SPACE_ID,
  WATERMARK_CONFIG_ID,
  CDA_ACCESS_TOKEN,
  CMA_ACCESS_TOKEN
} = process.env;

/**
 * *****************************************************************************
 * Utilities
 */

/**
 * Remove `//` from a URL and replace it with `https://`
 * @param {String} url
 */
const httpsify = url => url.replace('//', 'https://');

/**
 * Prepend the watermarked symbol string to a string
 * @param {String} str
 */
const addWatermarkString = str => `[WATERMARKED] ${str}`;

/**
 * Format a proper response object ready to be used
 * a response of the executed Lambda function
 * @param {Number} statusCode
 * @param {String} message
 */
const getResponseObject = (statusCode, message = 'No message provided') => {
  return {
    statusCode,
    message
  };
};

/**
 * Jimbdo only is capable of returning a buffer
 * asset upload to Contentful is recommended useing a
 * stream -> transform from on to another
 * @param {Buffer} buffer
 */
const bufferToStream = buffer => {
  let stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

/**
 * *****************************************************************************
 * Contentful helper functions
 */

/**
 * Helper function to abstract the API_TOKEN and overall endpoint away
 * @param {String(entries|assets)} resource
 * @param {String} queryParams
 */
const getContentful = async (resource, queryParams) => {
  return (await get(
    `https://cdn.contentful.com/spaces/${SPACE_ID}/environments/master/${resource}/?${queryParams}&access_token=${CDA_ACCESS_TOKEN}`,
    { json: true }
  )).body;
};

/**
 * Get Contentful entry that holds the configuration for the watermark
 * @param {String} id
 */
const getConfig = async id => {
  const response = await getContentful(
    'entries',
    `sys.id=${WATERMARK_CONFIG_ID}`
  );
  const [image] = response.includes.Asset;
  return { imageUrl: image.fields.file.url };
};

/**
 * Get an assets with certain filename, width and height
 * -> used to avoid duplicated uploads
 * @param {Object} params
 */
const getAsset = async ({ fileName, width, height }) => {
  const response = await getContentful(
    'assets',
    `fields.file.fileName=${fileName}&fields.file.details.image.width=${width}&fields.file.details.image.height=${height}`
  );
  return response.items[0];
};

/**
 * Upload a new asset to Contentful
 * @param {Object} params
 */
const uploadAsset = async ({
  title,
  description,
  fileName,
  contentType,
  stream
}) => {
  const client = contentful.createClient({ accessToken: CMA_ACCESS_TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment('master');
  let asset = await env.createAssetFromFiles({
    fields: {
      title: {
        'en-US': title
      },
      description: {
        'en-US': description
      },
      file: {
        'en-US': {
          contentType,
          fileName,
          file: stream
        }
      }
    }
  });
  asset = await asset.processForAllLocales();
  asset = await asset.publish();
};

module.exports.watermark = async event => {
  try {
    console.log(
      `Received webhook: ${JSON.stringify(JSON.parse(event.body), null, 2)}`
    );
    const {
      url,
      title,
      description,
      fileName,
      contentType,
      width,
      height
    } = JSON.parse(event.body);

    // validate the incoming payload to not trigger loops
    // and avoid computation
    if (contentType !== 'image/jpeg') {
      console.log("Skipped this hook... It's not a jpeg.");
      return getResponseObject(200, 'Skipped – no jpeg');
    }

    if (/^\[WATERMARKED\]/.test(fileName)) {
      console.log("Skipped this hook... It's marked alreay.");
      return getResponseObject(200, 'Skipped - marked already');
    }

    if (width < 2000) {
      console.log("Skipped this hook... It's too small.");
      return getResponseObject(200, 'Skipped – image too small');
    }

    if (
      await getAsset({ fileName: addWatermarkString(fileName), width, height })
    ) {
      console.log('Skipped this hook... Watermark already exists.');
      return getResponseObject(200, 'Skipped - watermark already exists');
    }

    // load the image that is defined in the file URL
    const original = await Jimp.read(httpsify(url));

    // get the configuration information that is also stored
    // in a Contentful entry
    const config = await getConfig(WATERMARK_CONFIG_ID);

    // load the image that should be used as watermark logo
    // and make it translucent
    const mark = (await Jimp.read(httpsify(config.imageUrl))).opacity(0.4);

    // composite the two images and unify them
    const watermarkedImage = await original.composite(mark, 50, 50);

    // upload the watermarked result image back to contentful
    await uploadAsset({
      title: addWatermarkString(title),
      contentType,
      description,
      fileName: addWatermarkString(fileName),
      stream: bufferToStream(await watermarkedImage.getBufferAsync(Jimp.AUTO))
    });

    return getResponseObject(201, 'Created');
  } catch (e) {
    console.log(e);
    return getResponseObject(500, e.message);
  }
};
