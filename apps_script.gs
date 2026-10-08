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
const SHEET_ID = "1Ua_U1vrazAWs02pnfVX2ilP2v6-RrohJh6kPwA4LLLo";

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

// Run once from the Apps Script editor as the owner. Share the logged invite code
// only with trusted family members. The server stores only its SHA-256 hash.
function setupInviteCode() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("INVITE_CODE_HASH")) throw new Error("Mã giới thiệu đã được tạo. Chạy resetInviteCode nếu muốn cấp mã mới.");
  const code = newInviteCode_();
  props.setProperty("INVITE_CODE_HASH", hashToken_(code));
  clearInviteFailures_(props);
  Logger.log("Mã giới thiệu (6 chữ số): " + code);
}

function resetInviteCode() {
  const props = PropertiesService.getScriptProperties();
  const code = newInviteCode_();
  props.setProperty("INVITE_CODE_HASH", hashToken_(code));
  clearInviteFailures_(props);
  Logger.log("Mã giới thiệu mới (6 chữ số): " + code);
  Logger.log("Thiết bị đã kích hoạt vẫn được giữ quyền. Chạy revokeAllDevices nếu muốn thu hồi chúng.");
}

function revokeAllDevices() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter(k => k.indexOf("DEVICE_") === 0).forEach(k => props.deleteProperty(k));
}

function newInviteCode_() {
  return String(parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 8), 16) % 1000000).padStart(6, "0");
}

function hashToken_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function clearInviteFailures_(props) {
  props.deleteProperty("INVITE_FAIL_COUNT");
  props.deleteProperty("INVITE_LOCKED");
}

function activateDevice_(code) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const inviteHash = props.getProperty("INVITE_CODE_HASH");
    if (!inviteHash) return json_({ok:false,error:"Chủ tủ thuốc chưa tạo mã giới thiệu. Hãy chạy setupInviteCode trong Apps Script."});
    if (props.getProperty("INVITE_LOCKED") === "1") return json_({ok:false,error:"Đã khóa sau 3 lần nhập sai. Chủ tủ thuốc cần tạo mã mới để mở khóa.",locked:true});
    if (String(code || "").trim() !== String(code || "").trim().replace(/\D/g, "") || hashToken_(String(code || "").trim()) !== inviteHash) {
      const failures = Number(props.getProperty("INVITE_FAIL_COUNT") || 0) + 1;
      props.setProperty("INVITE_FAIL_COUNT", String(failures));
      if (failures >= 3) props.setProperty("INVITE_LOCKED", "1");
      return json_({ok:false,error:failures >= 3 ? "Sai 3 lần. Đã khóa đến khi chủ tủ thuốc tạo mã mới." : "Mã giới thiệu không đúng.",attemptsRemaining:Math.max(0,3-failures),locked:failures >= 3});
    }
    clearInviteFailures_(props);
    const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("DEVICE_" + hashToken_(token), "1");
    return json_({ok:true,deviceToken:token});
  } finally { lock.releaseLock(); }
}

function deviceAuthorized_(token) {
  if (!token || String(token).length < 40) return false;
  return PropertiesService.getScriptProperties().getProperty("DEVICE_" + hashToken_(token)) === "1";
}

function doGet(e) {
  if (!deviceAuthorized_(e && e.parameter && e.parameter.deviceToken)) return json_({ok:false,error:"Device activation required."});
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
  if (body.action === "activateDevice") return activateDevice_(body.code);
  if (!deviceAuthorized_(body.deviceToken)) return json_({ok:false,error:"Device activation required."});
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
