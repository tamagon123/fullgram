/**
 * fullgram Portal Site 用 メール通知 + Google Drive 自動保存 API
 *
 * デプロイ方法:
 * 1. https://script.google.com/ で新しいプロジェクトを作成
 * 2. このコードを貼り付ける
 * 3. 「デプロイ」→「新しいデプロイ」→「種類の選択」→「Webアプリ」
 * 4. 実行ユーザー: 自分
 *    アクセスできるユーザー: 全員
 * 5. デプロイして Web App URL を取得
 * 6. アプリ側の「通知設定」に URL を設定
 *
 * 初回実行時は Gmail / Google Drive へのアクセス権限承認が必要です。
 */

const GAS_TOKEN = 'fullgram-portal-token-2026';
const DEFAULT_TO_EMAIL = 'tamagon123@gmail.com';
const DRIVE_FOLDER_ID = '1y_i3qFdUqNQgPqLooP-sSVs8xXJ4XBhk';

function doPost(e) {
  Logger.log('doPost called');
  Logger.log(e.postData.contents);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Lock timeout' });
  }

  let driveResult = null;
  let driveError = null;
  let data = {};

  try {
    data = JSON.parse(e.postData.contents || '{}');

    if (data.token !== GAS_TOKEN) {
      lock.releaseLock();
      return jsonResponse({ success: false, error: 'Invalid token' });
    }

    if (data.saveToDrive && data.saveToDrive.filename && data.saveToDrive.content) {
      try {
        driveResult = saveToDrive(data.saveToDrive.filename, data.saveToDrive.content, data.saveToDrive.mimeType);
      } catch (error) {
        driveError = error.toString();
      }
    }

    const subject = `[fullgram Portal] ${data.type || 'データ'}の${data.action || '更新'}通知`;
    const body = buildEmailBody(data, driveResult, driveError);

    GmailApp.sendEmail(
      data.to || DEFAULT_TO_EMAIL,
      subject,
      body,
      { name: 'fullgram Portal' }
    );

    lock.releaseLock();

    if (driveError) {
      return jsonResponse({ success: false, error: driveError, drive: driveResult });
    }

    return jsonResponse({ success: true, drive: driveResult });
  } catch (error) {
    lock.releaseLock();
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function saveToDrive(filename, content, mimeType) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const type = mimeType || MimeType.PLAIN_TEXT;
  const files = folder.getFilesByName(filename);

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return { updated: true, filename: filename, id: file.getId() };
  }

  const file = folder.createFile(filename, content, type);
  return { created: true, filename: filename, id: file.getId() };
}

function buildEmailBody(data, driveResult, driveError) {
  const lines = [
    'fullgram Portal Site のデータ登録が更新されました。',
    '',
    `【種類】 ${data.type || '-'}`,
    `【操作】 ${data.action || '-'}`,
    `【項目名】 ${data.itemName || '-'}`,
    `【日時】 ${new Date().toLocaleString('ja-JP')}`,
    ''
  ];

  if (data.detail) {
    lines.push('【詳細】');
    lines.push(data.detail);
    lines.push('');
  }

  if (driveResult) {
    lines.push('【Google Drive 自動保存】');
    if (driveResult.updated) {
      lines.push(`${driveResult.filename} を更新しました`);
    } else {
      lines.push(`${driveResult.filename} を新規作成しました`);
    }
    lines.push(`https://drive.google.com/file/d/${driveResult.id}/view`);
    lines.push('');
  }

  if (driveError) {
    lines.push('【Google Drive 自動保存エラー】');
    lines.push(driveError);
    lines.push('');
  }

  return lines.join('\n');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   以下はデバッグ用関数です。
   実行したい関数の名前を選択して「実行」してください。
   ============================================================ */

function testDriveAccess() {
  try {
    Logger.log('DRIVE_FOLDER_ID: ' + DRIVE_FOLDER_ID);
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    Logger.log('フォルダ名: ' + folder.getName());
    const newFile = folder.createFile('gas-test.txt', 'test', MimeType.PLAIN_TEXT);
    Logger.log('ファイル作成成功: ' + newFile.getId());
  } catch (e) {
    Logger.log('エラー: ' + e.toString());
  }
}

function testSaveToDrive() {
  saveToDrive('test.json', '{"test": true}', MimeType.JSON);
}

function testSaveDebug() {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    Logger.log('フォルダ名: ' + folder.getName());
    const result = saveToDrive('test.json', '{"test": true}', MimeType.JSON);
    Logger.log('結果: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('エラー: ' + e.toString());
  }
}
