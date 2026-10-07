/*
TỦ THUỐC GIA ĐÌNH - Google Apps Script
1) Tạo một Google Sheet mới.
2) Extensions > Apps Script.
3) Dán toàn bộ code này vào Code.gs.
4) Thay SHEET_ID bằng ID trong URL Google Sheet.
5) Deploy > New deployment > Web app.
   Execute as: Me
   Who has access: Anyone with the link
6) Copy URL /exec và dán vào API_URL trong index.html.

Sheet sẽ tự tạo 2 trang:
THUOC và LICH_SU
*/
const SHEET_ID = "DAN_ID_GOOGLE_SHEET_VAO_DAY";

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function doGet() {
  const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú"]);
  const values = sh.getDataRange().getValues();
  const drugs = values.slice(1).filter(r => r[0] !== "").map(r => ({
    id:String(r[0]), name:String(r[1]), qty:Number(r[2]||0), unit:String(r[3]||""),
    expiry:r[4] ? Utilities.formatDate(new Date(r[4]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "",
    minQty:Number(r[5]||0), use:String(r[6]||""), dose:String(r[7]||""), note:String(r[8]||"")
  }));
  return json_({ok:true,drugs});
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents || "{}"); }
  catch (err) { return json_({ok:false,error:"Invalid JSON"}); }
  if (body.action !== "replaceAll" || !Array.isArray(body.drugs))
    return json_({ok:false,error:"Expected action replaceAll and a drugs array"});

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú"]);
    if (sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,9).clearContent();
    const rows = body.drugs.map(x => [x.id,x.name,Number(x.qty||0),x.unit||"",x.expiry?new Date(x.expiry):"",Number(x.minQty||0),x.use||"",x.dose||"",x.note||""]);
    if(rows.length) sh.getRange(2,1,rows.length,9).setValues(rows);
    return json_({ok:true,count:rows.length});
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
