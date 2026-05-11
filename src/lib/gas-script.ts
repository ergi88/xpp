// Source of truth for the Google Apps Script body users paste into the
// Apps Script editor. Bumped whenever GAS-side semantics change so the in-app
// banner can prompt existing users to redeploy.

export const GAS_SCRIPT_VERSION = 2;

export const GAS_SCRIPT = `var SPREADSHEET_ID = '';

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
    clearCache(resource);
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function getAllRows(resource) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'data_' + resource;
  var cached = cache.get(cacheKey);
  if (cached != null) return JSON.parse(cached);

  var sheet = getSheet(resource);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  var headers = values[0];
  var result = values.slice(1).map(function(row) { return rowToObj(headers, row); });

  // transactions/accounts can exceed 100KB cache limit — skip silently
  try { cache.put(cacheKey, JSON.stringify(result), 1200); } catch(e) {}
  return result;
}

function getRowById(resource, id) {
  var sheet = getSheet(resource);
  var rowIdx = findRowIndexById(sheet, id);
  if (!rowIdx) return null;
  var headers = getHeaders(sheet);
  return rowToObj(headers, sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0]);
}

function ensureColumns(sheet, headers, data) {
  Object.keys(data).forEach(function(key) {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
      sheet.getRange(1, headers.length).setValue(key);
    }
  });
  return headers;
}

function createRow(resource, data) {
  var sheet = getSheet(resource);
  var headers = getHeaders(sheet);

  // app always sends id and created_at — these are fallbacks only
  data.id = data.id || Utilities.getUuid();
  data.created_at = data.created_at || new Date().toISOString();

  if (headers.length === 0) {
    headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers = ensureColumns(sheet, headers, data);
  }

  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sheet.appendRow(row);
  return data;
}

function updateRow(resource, id, data) {
  var sheet = getSheet(resource);
  var rowIdx = findRowIndexById(sheet, id);
  if (!rowIdx) throw new Error('Row not found: ' + id);

  var headers = getHeaders(sheet);
  headers = ensureColumns(sheet, headers, data);
  var current = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  var updated = current.map(function(val, i) {
    return data[headers[i]] !== undefined ? data[headers[i]] : val;
  });
  sheet.getRange(rowIdx, 1, 1, headers.length).setValues([updated]);
  return rowToObj(headers, updated);
}

function deleteRow(resource, id) {
  var sheet = getSheet(resource);
  var rowIdx = findRowIndexById(sheet, id);
  if (!rowIdx) throw new Error('ID not found: ' + id);
  sheet.deleteRow(rowIdx);
}

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  return lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
}

function findRowIndexById(sheet, id) {
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf('id') + 1;
  if (idCol < 1) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var finder = sheet.getRange(2, idCol, lastRow - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : null;
}

function clearCache(resource) {
  try { CacheService.getScriptCache().remove('data_' + resource); } catch(e) {}
}

function rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
