// -----------------------------------------------------------
// COPY THIS CODE INTO YOUR GOOGLE SHEET SCRIPT EDITOR
// Extensions > Apps Script > Paste > Deploy > New Deployment
// -----------------------------------------------------------

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    try {
        var action = e.parameter.action || "";
        var targetId = e.parameter.id || "";

        // Handle POST data if present
        if (e.postData) {
            var params = JSON.parse(e.postData.contents);
            if (params.id) targetId = params.id;
            if (params.action) action = params.action;
        }

        // 1. Open the Sheets
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var clientSheet = ss.getSheets()[0];
        var newsSheet = ss.getSheetByName("News");

        // Fetch Client Data
        var clientData = clientSheet.getDataRange().getValues();
        var clientHeaders = clientData[0];

        // ACTION: GET DATA
        if (action === "getData") {
            var responseData = {
                clients: [],
                news: []
            };

            // Process Client Data
            for (var i = 1; i < clientData.length; i++) {
                var row = clientData[i];
                var obj = {};
                for (var j = 0; j < clientHeaders.length; j++) {
                    var headerName = clientHeaders[j].toString().trim();
                    if (!headerName) {
                        headerName = "Column " + String.fromCharCode(65 + j); // A, B, C...
                    }
                    obj[headerName] = row[j];
                }
                responseData.clients.push(obj);
            }

            // Process News Data
            if (newsSheet) {
                var newsData = newsSheet.getDataRange().getValues();
                var newsHeaders = newsData[0];
                for (var k = 1; k < newsData.length; k++) {
                    var nRow = newsData[k];
                    var nObj = {};
                    for (var m = 0; m < newsHeaders.length; m++) {
                        var nHeader = newsHeaders[m].toString().trim();
                        if (nHeader) nObj[nHeader] = nRow[m];
                    }
                    if (Object.keys(nObj).length > 0) responseData.news.push(nObj);
                }
            }

            return ContentService.createTextOutput(JSON.stringify(responseData))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // ACTION: UPDATE (Existing logic - points to first sheet)
        var headers = clientHeaders;
        var data = clientData;
        var sheet = clientSheet;
        var updateColIndex = -1;
        for (var i = 0; i < headers.length; i++) {
            var h = headers[i].toString().toLowerCase().trim();
            if (h == "check bar" || h == "update requested") {
                updateColIndex = i + 1;
                break;
            }
        }

        if (updateColIndex == -1) {
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Column 'Check Bar' not found" })).setMimeType(ContentService.MimeType.JSON);
        }

        // Find Row
        var rowIndex = -1;
        for (var j = 1; j < data.length; j++) {
            if (data[j][0].toString() == targetId) {
                rowIndex = j + 1;
                break;
            }
        }

        if (rowIndex == -1) {
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "ID not found: " + targetId })).setMimeType(ContentService.MimeType.JSON);
        }

        // Update Cell
        var timestamp = new Date().toLocaleString();
        sheet.getRange(rowIndex, updateColIndex).setValue("Update Requested: " + timestamp);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "id": targetId })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
