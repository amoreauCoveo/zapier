'use strict';

const push = require('../config').PUSH;
const getOutputInfo = require('./responseContent').getOrgInfoForOutput;
const fileTooBig = require('../messages').BIG_FILE;
const handleError = require('../utils').handleError;
const fetchFileDetails = require('../utils').fetchFile;
const getStringByteSize = require('../utils').getStringByteSize;

const handlePushCreation = (z, bundle) => {

  //Temporary until I figure out a better way of handling artbitrary numbers of input fields
  bundle.inputData[bundle.inputData.field1] = bundle.inputData.field1Content;
  bundle.inputData[bundle.inputData.field2] = bundle.inputData.field2Content;
  bundle.inputData[bundle.inputData.field3] = bundle.inputData.field3Content;
  bundle.inputData['documentId'] = bundle.inputData.docId;
  delete bundle.inputData.docId;
  delete bundle.inputData.field1;
  delete bundle.inputData.field2;
  delete bundle.inputData.field3;
  delete bundle.inputData.field1Content;
  delete bundle.inputData.field2Content;
  delete bundle.inputData.field3Content;

  if(bundle.inputData.content == null || bundle.inputData.content == undefined || bundle.inputData.content == ''){
        
    bundle.inputData.content = 'No file/url supplied in the File input field.';
    return processPush(z, bundle);

  } else {


    const containerInfo = createContainer(z, bundle);

    return containerInfo.then((container) => {

      if(container.badFetch == true) {

        bundle.inputData.content = 'No file supplied in input, fetching the content failed, or a bad url was given.';
        return processPush(z, bundle);

      } else {

        delete bundle.inputData.data;
        bundle.inputData.compressedBinaryDataFileId = container.fileId;
        bundle.inputData.compressionType = 'UNCOMPRESSED';
        bundle.inputData.fileExtension = container.contentType;

        if(container.originalContentType === '.zip'){
          bundle.inputData.compressionType = 'DEFLATE';
        }

        return processPush(z, bundle);

      }

    })
      .catch(handleError);
  }
};

const processPush = (z, bundle) => {

  if(bundle.inputData.data == null || bundle.inputData.data == '' || bundle.inputData.data == undefined){
    delete bundle.inputData.data;
  }
  
  const promise = z.request({

    url: `https://` + push + `/v1/organizations/${bundle.inputData.orgId}/sources/${bundle.inputData.sourceId}/documents`,
    method: 'PUT',
    body: z.JSON.stringify(bundle.inputData),
    params: bundle.inputData,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  return promise.then((response) => {

    if (response.status !== 202) {
      throw new Error('Error occured sending push request to Coveo: ' + z.JSON.parse(response.content).message + ' Error Code: ' + response.status);
    }

    const responseOutput = z.JSON.parse(response.request.body);

    if(bundle.inputData.content){

      delete responseOutput.compressedBinaryDataFileId;
      delete responseOutput.compressionType;
      delete responseOutput.fileExtension;

    }

    return getOutputInfo(z, bundle, responseOutput);

  })
    .then((result) => {
      return result;
    })
    .catch(handleError);
};



const createContainer = (z, bundle) => {

  let url = `https://` + push + `/v1/organizations/${bundle.inputData.orgId}/files`;

  const promise = z.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  return promise.then((response) => {

    if (response.status !== 201) {
      throw new Error('Error creating file container: ' + z.JSON.parse(response.content).message + ' Error Code: ' + response.status);
    }

    const result = z.JSON.parse(response.content);
    return uploadToContainer(z, bundle, result);

  })
    .catch(handleError);
};



const uploadToContainer = (z, bundle, result) => {

  const containerInfo = {
    fileId: result.fileId,
    contentType: '',
    originalContentType: '',
  };

  let url = result.uploadUri;
  let file = bundle.inputData.content;

  const fileDetails = fetchFileDetails(file);

  return fileDetails.then((body) => {

    if(body.badFetch){

      containerInfo.badFetch = true;
      return containerInfo;

    } else {

      containerInfo.contentType = body.contentType;
      containerInfo.originalContentType = body.originalContentType;

      if (body.size > (1000000 * 1000) || getStringByteSize(body.content) > (1000000 * 1000)) {
        throw new Error(fileTooBig);
      }

      let headers = result.requiredHeaders;
      headers['content-length'] = body.size;

      if(headers['content-length'] == null){
        headers['content-length'] = getStringByteSize(body.content);
      }

      const promise = z.request(url, {
        method: 'PUT',
        body: body.content,
        headers: result.requiredHeaders,
      });

      return promise.then((response) => {

        if (response.status !== 200) {
          throw new Error('Error uploading file contents to container: ' + z.JSON.parse(response.content).message + ' Error Code: ' + response.status);
        }

        const result = z.JSON.stringify(response.content);
        return result;
      })
        .catch(handleError);
    }
  })
    .then(() => {
      return containerInfo;
    })
    .catch(handleError);
};

module.exports = {
  createContainer,
  uploadToContainer,
  processPush,
  handlePushCreation,
};
