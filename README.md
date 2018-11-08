# serverless-contentful-watermark

A serverless function to create Contentful images with watermarks

![Example flow automatically creating a watermarked image](./example.gif)

## How to get started

This project is built using the [serverless framework](https://www.serverless.com).

### Project structure

You can find all the configuration needed for the function included in this project in the `serverless.yml`. The `serverless.yml` is the main configuration file defining functions and routes for API Gateway.

### Install all dependencies

Thanks to the serverless project it is possible to include npm dependencies. Serverless will pick and pack the files it needs when you later deploy your function to AWS.

```
$ git clone git@github.com:stefanjudis/serverless-contentful-watermark.git
$ cd serverless-contentful-watermark
$ npm install
```

### Define environment variables

To upload watermarked images automatically you have to define the following environment variables in the session of your terminal.

```
export SPACE_ID=...
export CDA_ACCESS_TOKEN=...
export CMA_ACCESS_TOKEN=...
export WATERMARK_CONFIG_ID=...
```

Space ID, CDA and CMA access token are used authorize with the Contentful APIs. You can find more information in the [Authentication docs](https://www.contentful.com/developers/docs/references/authentication/).

#### The configuration content type

To keep this watermarker flexible the project relies on one entry stored in Contentful. This way you can change the watermark logo right inside of Contentful without the need to redeploy your serverless function.

![Content type controlling the watermark generation](./watermark-type.jpg)

Create a content type including to fields (`title` and `image`) in which `image` is reference to an asset. This asset will be the watermark logo that goes into every created asset.

Then, create one entry. This entry acts a overall watermark configuration. The entry of the created entry needs to be set as `WATERMARK_CONFIG_ID` so that the function can fetch the linked asset.

### Spin up the local development mode

To allow more convenient developement flow this project includes [serverless](https://serverless.com/) and [serverless-offline](https://www.npmjs.com/package/serverless-offline) as development dependencies.

This means that when you have the environment variables define you can spin up a local environment with one command.

```
$ npm run dev

> cf-serverless-contentful-watermark@1.0.0 dev /Users/stefanjudis/Projects/cf-serverless-contentful-watermark
> serverless offline start --noTimeout

Serverless: Starting Offline: dev/us-east-1.

Serverless: Routes for watermark:
Serverless: POST /watermark

Serverless: Offline listening on http://localhost:3000
```

## How to deploy to AWS

To deploy this function to AWS you can pass the environment variables to the `serverless deploy` command and the serverless framework takes care of packaging your code and configuring API Gateway.

```
$ SPACE_ID=... WATERMARK_CONFIG_ID=... CDA_ACCESS_TOKEN=... CMA_ACCESS_TOKEN=... serverless deploy
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service .zip file to S3 (10.34 MB)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
Serverless: Stack update finished...
Service Information
service: contentful-watermark
stage: dev
region: us-east-1
stack: contentful-watermark-dev
api keys:
  None
endpoints:
  POST - https://XXX.execute-api.us-east-1.amazonaws.com/dev/watermark
functions:
  watermark: contentful-watermark-dev-watermark
Serverless: Removing old service artifacts from S3...
```
