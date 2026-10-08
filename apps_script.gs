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
THUOC và THUOC_THU_VIEN
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
  const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú","Ảnh","ID thư viện"]);
  sh.getRange(1,10,1,2).setValues([["Ảnh","ID thư viện"]]);
  const values = sh.getDataRange().getValues();
  const drugs = values.slice(1).filter(r => r[0] !== "").map(r => ({
    id:String(r[0]), name:String(r[1]), qty:Number(r[2]||0), unit:String(r[3]||""),
    expiry:r[4] ? Utilities.formatDate(new Date(r[4]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "",
    minQty:Number(r[5]||0), use:String(r[6]||""), dose:String(r[7]||""), note:String(r[8]||""), image:String(r[9]||""), libraryId:String(r[10]||"")
  }));
  const library = readLibrary_();
  const deletedLibraryIds = JSON.parse(PropertiesService.getScriptProperties().getProperty("LIBRARY_DELETED_IDS") || "[]");
  return json_({ok:true,drugs,library,deletedLibraryIds});
}

function readLibrary_() {
  const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
  return sh.getDataRange().getValues().slice(1).filter(r => r[0] !== "").map(r => ({
    id:String(r[0]), name:String(r[1]), image:String(r[2]||""), use:String(r[3]||""), dose:String(r[4]||"")
  }));
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents || "{}"); }
  catch (err) { return json_({ok:false,error:"Invalid JSON"}); }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === "replaceAll" && Array.isArray(body.drugs)) {
      const sh = getSheet_("THUOC", ["ID","Tên thuốc","Số lượng","Đơn vị","Hạn sử dụng","Mức tối thiểu","Công dụng","Cách dùng","Ghi chú","Ảnh","ID thư viện"]);
      sh.getRange(1,10,1,2).setValues([["Ảnh","ID thư viện"]]);
      if (sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,11).clearContent();
      const rows = body.drugs.map(x => [x.id,x.name,Number(x.qty||0),x.unit||"",x.expiry?new Date(x.expiry):"",Number(x.minQty||0),x.use||"",x.dose||"",x.note||"",x.image||"",x.libraryId||""]);
      if(rows.length) sh.getRange(2,1,rows.length,11).setValues(rows);
      return json_({ok:true,count:rows.length});
    }
    if (body.action === "upsertLibrary" && body.entry && body.entry.id) {
      const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
      const ids = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String) : [];
      const found = ids.indexOf(String(body.entry.id));
      const row = [String(body.entry.id),String(body.entry.name||""),String(body.entry.image||""),String(body.entry.use||""),String(body.entry.dose||""),new Date()];
      const rowNumber = found<0 ? sh.getLastRow()+1 : found+2;
      sh.getRange(rowNumber,1,1,6).setValues([row]);
      const properties = PropertiesService.getScriptProperties();
      const deleted = JSON.parse(properties.getProperty("LIBRARY_DELETED_IDS") || "[]").filter(id => String(id) !== String(body.entry.id));
      properties.setProperty("LIBRARY_DELETED_IDS", JSON.stringify(deleted));
      return json_({ok:true,id:String(body.entry.id)});
    }
    if (body.action === "deleteLibrary" && body.id) {
      const sh = getSheet_("THUOC_THU_VIEN", ["ID","Tên thuốc","Ảnh","Công dụng","Cách dùng","Ngày lưu"]);
      const ids = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String) : [];
      const found = ids.indexOf(String(body.id));
      if (found>=0) sh.deleteRow(found+2);
      const properties = PropertiesService.getScriptProperties();
      const deleted = JSON.parse(properties.getProperty("LIBRARY_DELETED_IDS") || "[]").map(String);
      if (!deleted.includes(String(body.id))) deleted.push(String(body.id));
      properties.setProperty("LIBRARY_DELETED_IDS", JSON.stringify(deleted));
      return json_({ok:true,deleted:found>=0});
    }
    return json_({ok:false,error:"Unsupported action"});
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
