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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var clientSheet = ss.getSheets()[0];
    var newsSheet = ss.getSheetByName("News");
    var accessSheet = ss.getSheetByName("Access") || createAccessSheet(ss);
    var logSheet = ss.getSheetByName("Logs") || createLogSheet(ss);

    try {
        var params = e.parameter || {};
        if (e.postData) {
            var postParams = JSON.parse(e.postData.contents);
            for (var key in postParams) params[key] = postParams[key];
        }

        var action = params.action || "";
        var deviceId = params.deviceId || "";
        var userName = params.userName || "Unknown";
        var targetId = params.id || "";

        // 1. Audit Log (All requests)
        logAccess(logSheet, deviceId, userName, action, targetId);

        // 2. Action: Request Access (Always allowed)
        if (action === "requestAccess") {
            if (!deviceId) return jsonResponse({ "result": "error", "message": "Missing Device ID" });
            return registerDevice(accessSheet, deviceId, userName);
        }

        // 3. Security Check: Validate Device ID
        var accessStatus = checkAccess(accessSheet, deviceId);
        var normalizedStatus = accessStatus.toString().toLowerCase().trim();

        if (normalizedStatus !== "approved" && normalizedStatus !== "active") {
            return jsonResponse({
                "result": "restricted",
                "status": accessStatus,
                "message": normalizedStatus === "pending" ? "Your access request is pending approval." : "Access Denied. Please request access."
            });
        }

        // --- PROTECTED ACTIONS BELOW ---

        // ACTION: GET DATA
        if (action === "getData") {
            var responseData = { clients: [], news: [] };
            var clientData = clientSheet.getDataRange().getValues();
            var clientHeaders = clientData[0];

            for (var i = 1; i < clientData.length; i++) {
                var row = clientData[i];
                var obj = {};
                for (var j = 0; j < clientHeaders.length; j++) {
                    var h = clientHeaders[j].toString().trim() || "Col " + j;
                    obj[h] = row[j];
                }
                responseData.clients.push(obj);
            }

            if (newsSheet) {
                var newsData = newsSheet.getDataRange().getValues();
                var newsHeaders = newsData[0];
                for (var k = 1; k < newsData.length; k++) {
                    var nRow = newsData[k];
                    var nObj = {};
                    for (var m = 0; m < newsHeaders.length; m++) {
                        var nh = newsHeaders[m].toString().trim();
                        if (nh) nObj[nh] = nRow[m];
                    }
                    if (Object.keys(nObj).length > 0) responseData.news.push(nObj);
                }
            }
            return jsonResponse(responseData);
        }

        // ACTION: UPDATE
        if (action === "request_update" || action === "update") {
            var data = clientSheet.getDataRange().getValues();
            var headers = data[0];
            var colIdx = -1;
            for (var i = 0; i < headers.length; i++) {
                var h = headers[i].toString().toLowerCase().trim();
                if (h == "check bar" || h == "update requested") { colIdx = i + 1; break; }
            }
            if (colIdx == -1) return jsonResponse({ "result": "error", "message": "Column 'Check Bar' not found" });

            var rowIdx = -1;
            for (var j = 1; j < data.length; j++) {
                if (data[j][0].toString() == targetId) { rowIdx = j + 1; break; }
            }
            if (rowIdx == -1) return jsonResponse({ "result": "error", "message": "ID not found" });

            clientSheet.getRange(rowIdx, colIdx).setValue("Update Requested: " + new Date().toLocaleString() + " by " + userName);
            return jsonResponse({ "result": "success", "id": targetId });
        }

        return jsonResponse({ "result": "error", "message": "Unknown action" });

    } catch (error) {
        return jsonResponse({ "result": "error", "message": error.toString() });
    }
}

function checkAccess(sheet, id) {
    if (!id) return "None";
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return "None"; // Only headers exist

    for (var i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString() === id) {
            return data[i][2] || "Pending"; // Return status or default to Pending
        }
    }
    return "None";
}

function registerDevice(sheet, id, name) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString() === id) {
            return jsonResponse({ "result": "success", "status": data[i][2] || "Pending" });
        }
    }
    sheet.appendRow([id, name, "Pending", new Date()]);
    return jsonResponse({ "result": "success", "status": "Pending" });
}

function logAccess(sheet, id, name, action, target) {
    try {
        sheet.appendRow([new Date(), id || "N/A", name || "Unknown", action || "None", target || "N/A"]);
    } catch (e) { }
}

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function createAccessSheet(ss) {
    var s = ss.insertSheet("Access");
    s.appendRow(["Device ID", "User Name", "Status", "Request Date"]);
    s.getRange("A1:D1").setFontWeight("bold").setBackground("#f3f3f3");
    return s;
}

function createLogSheet(ss) {
    var s = ss.insertSheet("Logs");
    s.appendRow(["Timestamp", "Device ID", "User Name", "Action", "Target ID"]);
    s.getRange("A1:E1").setFontWeight("bold").setBackground("#f3f3f3");
    return s;
}
