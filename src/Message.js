import C from './constants.js';

DicomMessage = (syntax) => {
  this.syntax = syntax ? syntax : null;
  this.type = C.DATA_TYPE_COMMAND;
  this.messageId = C.DEFAULT_MESSAGE_ID;
  this.elementPairs = {};
};

DicomMessage.prototype.isCommand = () => this.type == C.DATA_TYPE_COMMAND;

DicomMessage.prototype.setSyntax = (syntax) => {
  this.syntax = syntax;

  for (const tag in this.elementPairs) {
    this.elementPairs[tag].setSyntax(this.syntax);
  }
};

DicomMessage.prototype.setMessageId = (id) => {
  this.messageId = id;
};

DicomMessage.prototype.setReplyMessageId = (id) => {
  this.replyMessageId = id;
};

DicomMessage.prototype.command = (cmds) => {
  cmds.unshift(this.newElement(0x00000800, this.dataSetPresent ? C.DATA_SET_PRESENT : C.DATE_SET_ABSENCE));
  cmds.unshift(this.newElement(0x00000700, this.priority));
  cmds.unshift(this.newElement(0x00000110, this.messageId));
  cmds.unshift(this.newElement(0x00000100, this.commandType));
  cmds.unshift(this.newElement(0x00000002, this.contextUID));

  let length = 0;

  cmds.forEach((cmd) => {
    length += cmd.length(cmd.getFields());
  });

  cmds.unshift(this.newElement(0x00000000, length));

  return cmds;
};

DicomMessage.prototype.response = (cmds) => {
  cmds.unshift(this.newElement(0x00000800, this.dataSetPresent ? C.DATA_SET_PRESENT : C.DATE_SET_ABSENCE));
  cmds.unshift(this.newElement(0x00000120, this.replyMessageId));
  cmds.unshift(this.newElement(0x00000100, this.commandType));
  if (this.contextUID) {
    cmds.unshift(this.newElement(0x00000002, this.contextUID));
  }

  let length = 0;

  cmds.forEach((cmd) => {
    length += cmd.length(cmd.getFields());
  });

  cmds.unshift(this.newElement(0x00000000, length));

  return cmds;
};

DicomMessage.prototype.setElements = (pairs) => {
  const p = {};

  for (const tag in pairs) {
    p[tag] = this.newElement(tag, pairs[tag]);
  }

  this.elementPairs = p;
};

DicomMessage.prototype.newElement = (tag, value) => elementByType(tag, value, this.syntax);

DicomMessage.prototype.setElement = (key, value) => {
  this.elementPairs[key] = elementByType(key, value);
};

DicomMessage.prototype.setElementPairs = (pairs) => {
  this.elementPairs = pairs;
};

DicomMessage.prototype.setContextId = (context) => {
  this.contextUID = context;
};

DicomMessage.prototype.setPriority = (pri) => {
  this.priority = pri;
};

DicomMessage.prototype.setType = (type) => {
  this.type = type;
};

DicomMessage.prototype.setDataSetPresent = (present) => {
  this.dataSetPresent = present != 0x0101;
};

DicomMessage.prototype.haveData = () => this.dataSetPresent;

DicomMessage.prototype.tags = () => Object.keys(this.elementPairs);

DicomMessage.prototype.key = (tag) => elementKeywordByTag(tag);

DicomMessage.prototype.getValue = (tag) => this.elementPairs[tag] ? this.elementPairs[tag].getValue() : null;

DicomMessage.prototype.affectedSOPClassUID = () => this.getValue(0x00000002);

DicomMessage.prototype.getMessageId = () => this.getValue(0x00000110);

DicomMessage.prototype.getFields = () => {
  const eles = [];

  for (const tag in this.elementPairs) {
    eles.push(this.elementPairs[tag]);
  }

  return eles;
};

DicomMessage.prototype.length = (elems) => {
  let len = 0;

  elems.forEach((elem) => {
    len += elem.length(elem.getFields());
  });

  return len;
};

DicomMessage.prototype.isResponse = () => false;

DicomMessage.prototype.is = (type) => this.commandType == type;

DicomMessage.prototype.write = (stream) => {
  let fields = this.getFields(),
    o = this;

  fields.forEach((field) => {
    field.setSyntax(o.syntax);
    field.write(stream);
  });
};

DicomMessage.prototype.printElements = (pairs, indent) => {
  let typeName = '';

  for (const tag in pairs) {
    const value = pairs[tag].getValue();

    typeName += `${(' '.repeat(indent)) + this.key(tag)} : `;
    if (value instanceof Array) {
      var o = this;

      value.forEach((p) => {
        if (typeof p === 'object') {
          typeName += `[\n${o.printElements(p, indent + 2)}${' '.repeat(indent)}]`;
        } else {
          typeName += `[${p}]`;
        }
      });
      if (typeName[typeName.length - 1] != '\n') {
        typeName += '\n';
      }
    } else {
      typeName += `${value}\n`;
    }
  }

  return typeName;
};

DicomMessage.prototype.typeString = () => {
  let typeName = '';

  if (!this.isCommand()) {
    typeName = 'DateSet Message';
  } else {
    switch (this.commandType) {
    case C.COMMAND_C_GET_RSP : typeName = 'C-GET-RSP'; break;
    case C.COMMAND_C_MOVE_RSP : typeName = 'C-MOVE-RSP'; break;
    case C.COMMAND_C_GET_RQ : typeName = 'C-GET-RQ'; break;
    case C.COMMAND_C_STORE_RQ : typeName = 'C-STORE-RQ'; break;
    case C.COMMAND_C_FIND_RSP : typeName = 'C-FIND-RSP'; break;
    case C.COMMAND_C_MOVE_RQ : typeName = 'C-MOVE-RQ'; break;
    case C.COMMAND_C_FIND_RQ : typeName = 'C-FIND-RQ'; break;
    case C.COMMAND_C_STORE_RSP : typeName = 'C-STORE-RSP'; break;
    }
  }

  return typeName;
};

DicomMessage.prototype.toString = () => {
  let typeName = this.typeString();

  typeName += ' [\n';
  typeName += this.printElements(this.elementPairs, 0);
  typeName += ']';

  return typeName;
};

DicomMessage.prototype.walkObject = (pairs) => {
  let obj = {},
    o = this;

  for (const tag in pairs) {
    var v = pairs[tag].getValue(),
      u = v;

    if (v instanceof Array) {
      u = [];
      v.forEach((a) => {
        if (typeof a === 'object') {
          u.push(o.walkObject(a));
        } else {
          u.push(a);
        }
      });
    }

    obj[tag] = u;
  }

  return obj;
};

DicomMessage.prototype.toObject = () => {
  return this.walkObject(this.elementPairs);
};

DicomMessage.readToPairs = (stream, syntax, options) => {
  const pairs = {};

  while (!stream.end()) {
    const elem = new DataElement();

    if (options) {
      elem.setOptions(options);
    }

    elem.setSyntax(syntax);
    elem.readBytes(stream);
    pairs[elem.tag.value] = elem;
  }

  return pairs;
};

const fileValid = (stream) => {
  return stream.readString(4, C.TYPE_ASCII) == 'DICM';
};

const readMetaStream = (stream, useSyntax, length, callback) => {
  const message = new FileMetaMessage();

  message.setElementPairs(DicomMessage.readToPairs(stream, useSyntax));
  if (callback) {
    callback(null, message, length);
  }

  return message;
};

DicomMessage.readMetaHeader = (bufferOrFile, callback) => {
  const useSyntax = C.EXPLICIT_LITTLE_ENDIAN;

  if (bufferOrFile instanceof Buffer) {
    const stream = new ReadStream(bufferOrFile);

    stream.reset();
    stream.increment(128);
    if (!fileValid(stream)) {
      return quitWithError('Invalid a dicom file ', callback);
    }

    let el = readAElement(stream, useSyntax),
      metaLength = el.value,
      metaStream = stream.more(metaLength);

    return readMetaStream(metaStream, useSyntax, metaLength, callback);
  } else if (typeof bufferOrFile === 'string') {
    fs.open(bufferOrFile, 'r', (err, fd) => {
      if (err) {
        // Fs.closeSync(fd);
        return quitWithError('Cannot open file', callback);
      }

      const buffer = Buffer.alloc(16);

      fs.read(fd, buffer, 0, 16, 128, (err, bytesRead) => {
        if (err || bytesRead != 16) {
          fs.closeSync(fd);

          return quitWithError('Cannot read file', callback);
        }

        const stream = new ReadStream(buffer);

        if (!fileValid(stream)) {
          fs.closeSync(fd);

          return quitWithError(`Not a dicom file ${bufferOrFile}`, callback);
        }

        let el = readAElement(stream, useSyntax),
          metaLength = el.value,
          metaBuffer = Buffer.alloc(metaLength);

        fs.read(fd, metaBuffer, 0, metaLength, 144, (err, bytesRead) => {
          fs.closeSync(fd);
          if (err || bytesRead != metaLength) {
            return quitWithError(`Invalid a dicom file ${bufferOrFile}`, callback);
          }

          const metaStream = new ReadStream(metaBuffer);

          return readMetaStream(metaStream, useSyntax, metaLength, callback);
        });
      });
    });
  }

  return null;
};

DicomMessage.read = (stream, type, syntax, options) => {
  let elements = [],
    pairs = {},
    useSyntax = type == C.DATA_TYPE_COMMAND ? C.IMPLICIT_LITTLE_ENDIAN : syntax;

  stream.reset();
  while (!stream.end()) {
    const elem = new DataElement();

    if (options) {
      elem.setOptions(options);
    }

    elem.setSyntax(useSyntax);
    elem.readBytes(stream);// Return;
    pairs[elem.tag.value] = elem;
  }

  let message = null;

  if (type == C.DATA_TYPE_COMMAND) {
    const cmdType = pairs[0x00000100].value;

    switch (cmdType) {
    case 0x8020 : message = new CFindRSP(useSyntax); break;
    case 0x8021 : message = new CMoveRSP(useSyntax); break;
    case 0x8010 : message = new CGetRSP(useSyntax); break;
    case 0x0001 : message = new CStoreRQ(useSyntax); break;
    case 0x0020 : message = new CFindRQ(useSyntax); break;
    case 0x8001 : message = new CStoreRSP(useSyntax); break;
    default : throw `Unrecognized command type ${cmdType.toString(16)}`; break;
    }

    message.setElementPairs(pairs);
    message.setDataSetPresent(message.getValue(0x00000800));
    message.setContextId(message.getValue(0x00000002));
    if (!message.isResponse()) {
      message.setMessageId(message.getValue(0x00000110));
    } else {
      message.setReplyMessageId(message.getValue(0x00000120));
    }
  } else if (type == C.DATA_TYPE_DATA) {
    message = new DataSetMessage(useSyntax);
    message.setElementPairs(pairs);
  } else {
    throw 'Unrecognized message type';
  }

  return message;
};

DataSetMessage = (syntax) => {
  DicomMessage.call(this, syntax);
  this.type = C.DATA_TYPE_DATA;
};

util.inherits(DataSetMessage, DicomMessage);

DataSetMessage.prototype.is = (type) => {
  return false;
};

FileMetaMessage = (syntax) => {
  DicomMessage.call(this, syntax);
  this.type = null;
};

util.inherits(FileMetaMessage, DicomMessage);

CFindRSP = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x8020;
};

util.inherits(CFindRSP, CommandResponse);

CGetRSP = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x8010;
};

util.inherits(CGetRSP, CommandResponse);

CMoveRSP = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x8021;
};

util.inherits(CMoveRSP, CommandResponse);

CFindRQ = (syntax) => {
  CommandMessage.call(this, syntax);
  this.commandType = 0x20;
  this.contextUID = C.SOP_STUDY_ROOT_FIND;
};

util.inherits(CFindRQ, CommandMessage);

CCancelRQ = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x0fff;
  this.contextUID = null;
  this.dataSetPresent = false;
};

util.inherits(CCancelRQ, CommandResponse);

CCancelMoveRQ = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x0fff;
  this.contextUID = null;
  this.dataSetPresent = false;
};

util.inherits(CCancelMoveRQ, CommandResponse);

CMoveRQ = (syntax, destination) => {
  CommandMessage.call(this, syntax);
  this.commandType = 0x21;
  this.contextUID = C.SOP_STUDY_ROOT_MOVE;
  this.setDestination(destination || '');
};

util.inherits(CMoveRQ, CommandMessage);

CMoveRQ.prototype.setStore = (cstr) => {
  this.store = cstr;
};

CMoveRQ.prototype.setDestination = (dest) => {
  this.setElement(0x00000600, dest);
};

CGetRQ = (syntax) => {
  CommandMessage.call(this, syntax);
  this.commandType = 0x10;
  this.contextUID = C.SOP_STUDY_ROOT_GET;
  this.store = null;
};

util.inherits(CGetRQ, CommandMessage);

CGetRQ.prototype.setStore = (cstr) => {
  this.store = cstr;
};

CStoreRQ = (syntax) => {
  CommandMessage.call(this, syntax);
  this.commandType = 0x01;
  this.contextUID = C.SOP_STUDY_ROOT_GET;
};

util.inherits(CStoreRQ, CommandMessage);

CStoreRQ.prototype.getOriginAETitle = () => {
  return this.getValue(0x00001030);
};

CStoreRQ.prototype.getMoveMessageId = () => {
  return this.getValue(0x00001031);
};

CStoreRQ.prototype.getAffectedSOPInstanceUID = () => {
  return this.getValue(0x00001000);
};

CStoreRQ.prototype.setAffectedSOPInstanceUID = (uid) => {
  this.setElement(0x00001000, uid);
};

CStoreRQ.prototype.setAffectedSOPClassUID = (uid) => {
  this.setElement(0x00000002, uid);
};

CStoreRSP = (syntax) => {
  CommandResponse.call(this, syntax);
  this.commandType = 0x8001;
  this.contextUID = C.SOP_STUDY_ROOT_GET;
  this.dataSetPresent = false;
};

util.inherits(CStoreRSP, CommandResponse);

CStoreRSP.prototype.setAffectedSOPInstanceUID = (uid) => {
  this.setElement(0x00001000, uid);
};

CStoreRSP.prototype.getAffectedSOPInstanceUID = (uid) => {
  return this.getValue(0x00001000);
};
