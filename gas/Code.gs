// Replace with your actual spreadsheet ID
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doGet(e) {
  try {
    var resource = e.parameter.resource;
    var action = e.parameter.action;
    var result;
    if (action === 'getAll') {
      result = getAllRows(resource);
    } else if (action === 'getById') {
      result = getRowById(resource, e.parameter.id);
    } else {
      throw new Error('Unknown action: ' + action);
    }
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var resource = body.resource;
    var result;
    if (action === 'create') {
      result = createRow(resource, body.data);
    } else if (action === 'update') {
      result = updateRow(resource, body.id, body.data);
    } else if (action === 'delete') {
      deleteRow(resource, body.id);
      result = { success: true };
    } else {
      throw new Error('Unknown action: ' + action);
    }
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getAllRows(resource) {
  var sheet = getSheet(resource);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) { return rowToObj(headers, row); });
}

function getRowById(resource, id) {
  var sheet = getSheet(resource);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  var headers = data[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      return rowToObj(headers, data[i]);
    }
  }
  return null;
}

function ensureColumns(sheet, headers, data) {
  var added = false;
  Object.keys(data).forEach(function(key) {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
      sheet.getRange(1, headers.length).setValue(key);
      added = true;
    }
  });
  return added;
}

function createRow(resource, data) {
  var sheet = getSheet(resource);
  var existing = sheet.getDataRange().getValues();
  var headers;
  if (existing.length === 0 || (existing.length === 1 && existing[0].every(function(c){ return c === ''; }))) {
    headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers = existing[0];
    ensureColumns(sheet, headers, data);
  }
  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sheet.appendRow(row);
  return data;
}

function updateRow(resource, id, data) {
  var sheet = getSheet(resource);
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  ensureColumns(sheet, headers, data);
  var idCol = headers.indexOf('id');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      headers.forEach(function(h, j) {
        if (data[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h]);
        }
      });
      var updated = rowToObj(headers, sheet.getRange(i + 1, 1, 1, headers.length).getValues()[0]);
      return updated;
    }
  }
  throw new Error('Row not found: ' + id);
}

function deleteRow(resource, id) {
  var sheet = getSheet(resource);
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error('Row not found: ' + id);
}

function rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
