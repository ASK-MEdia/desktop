import { ipcRenderer } from 'electron';
import {
  isBroadcasting,
  isPreviewing,
  isStreaming,
} from '../reducers/live';
import {
  isConverting,
  isReading,
  isRead,
  isUploading,
} from '../reducers/video';
import {
  toggleBroadcast,
  togglePreview,
  toggleStream,
} from '../actions/live';
import {
  startConversion,
  finishConversion,
  requestVideo,
  receiveVideo,
  uploadVideo,
} from '../actions/video';
import {
  getPreviewIndex,
  getCameraIndex,
  getRecordLocation,
  getStitcherLocation,
  getStreamUrl,
  getWidth,
  getHeight,
  getLocation,
} from '../reducers/preference';
import {
  ERROR_CAUGHT,
  RECORD,
  STOP,
  REQUEST_FILE,
  RECEIVE_FILE,
  START_PREVIEW,
  STOP_PREVIEW,
  START_STREAM,
  STOP_STREAM,
  STARTED_CONVERSION,
  FINISHED_CONVERSION,
} from './signals';

const sendErrorMessage = (msg) => {
  ipcRenderer.send(ERROR_CAUGHT, {
    msg,
  });
};

let currState = false;
let earlyExit = false;
export const handleRecordingChange = (store) => () => {
  const prevState = currState;
  const storeState = store.getState();
  currState = isStreaming(storeState);

  if (prevState !== currState) {
    if (currState) {
      if (isPreviewing(storeState)) {
        sendErrorMessage('Please stop the preview before recording.');
        earlyExit = true;
        store.dispatch(toggleStream());
      } else if (isBroadcasting(storeState)) {
        sendErrorMessage('Please stop the stream before recording.');
        earlyExit = true;
        store.dispatch(toggleStream());
      } else if (isConverting(storeState)) {
        sendErrorMessage('Please wait until video processing is done.');
        earlyExit = true;
        store.dispatch(toggleStream());
      } else if (isReading(storeState) || isRead(storeState) || isUploading(storeState)) {
        sendErrorMessage('Please wait until video uploading is done.');
        earlyExit = true;
        store.dispatch(toggleStream());
      } else {
        const arg = {
          recordLocation: getRecordLocation(storeState),
          stitcherLocation: getStitcherLocation(storeState),
          cameraIndex: getCameraIndex(storeState),
          url: getStreamUrl(storeState),
          width: getWidth(storeState),
          height: getHeight(storeState),
        };
        ipcRenderer.send(RECORD, arg);
        earlyExit = false;
      }
    } else if (!earlyExit) {
      ipcRenderer.send(STOP);
    }
  }
};

let currPreviewState = false;
export const handlePreviewChange = (store) => () => {
  const prevState = currPreviewState;
  const storeState = store.getState();
  currPreviewState = isPreviewing(storeState);

  if (prevState !== currPreviewState) {
    if (currPreviewState) {
      if (isStreaming(storeState)) {
        sendErrorMessage('Please stop the recording before previewing.');
        store.dispatch(togglePreview());
      } else if (isBroadcasting(storeState)) {
        sendErrorMessage('Please stop the stream before previewing.');
        store.dispatch(togglePreview());
      } else {
        const arg = {
          index: getPreviewIndex(storeState),
          stitcherLocation: getStitcherLocation(storeState),
          width: getWidth(storeState),
          height: getHeight(storeState),
        };
        ipcRenderer.send(START_PREVIEW, arg);
      }
    } else {
      ipcRenderer.send(STOP_PREVIEW);
    }
  }
};

let currBroadcastState = false;
export const handleBroadcastChange = (store) => () => {
  const prevState = currBroadcastState;
  const storeState = store.getState();
  currBroadcastState = isBroadcasting(storeState);

  if (prevState !== currBroadcastState) {
    if (currBroadcastState) {
      if (isPreviewing(storeState)) {
        sendErrorMessage('Please stop the preview before streaming.');
        store.dispatch(toggleBroadcast());
      } else if (isStreaming(storeState)) {
        sendErrorMessage('Please stop the recording before streaming.');
        store.dispatch(toggleBroadcast());
      } else {
        const arg = {
          index: getPreviewIndex(storeState),
          stitcherLocation: getStitcherLocation(storeState),
          url: getStreamUrl(storeState),
          width: getWidth(storeState),
          height: getHeight(storeState),
        };
        ipcRenderer.send(START_STREAM, arg);
      }
    } else {
      ipcRenderer.send(STOP_STREAM);
    }
  }
};

export const requestFile = (path) => {
  ipcRenderer.send(REQUEST_FILE, {
    path,
  });
};

export const reportError = (msg) => {
  ipcRenderer.send(ERROR_CAUGHT, {
    msg,
  });
};

export const setupIPCHandler = (store) => {
  ipcRenderer.on(RECEIVE_FILE, (event, arg) => {
    store.dispatch(receiveVideo(arg.path));

    const fileName = arg.path.substring(arg.path.lastIndexOf('/') + 1);
    const recordingLocation = getLocation(store.getState());

    uploadVideo(store.dispatch, fileName, arg.data, recordingLocation);
  });

  ipcRenderer.on(STARTED_CONVERSION, () => {
    store.dispatch(startConversion());
  });

  ipcRenderer.on(FINISHED_CONVERSION, (event, arg) => {
    store.dispatch(finishConversion());
    const videoPath = arg.outPath;
    store.dispatch(requestVideo(videoPath));
  });
};
