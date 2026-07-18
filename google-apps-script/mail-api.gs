/**
 * fullgram Portal Site 用 メール通知 API
 * 
 * デプロイ方法:
 * 1. https://script.google.com/ で新しいプロジェクトを作成
 * 2. このコードを貼り付ける
 * 3. 「デプロイ」→「新しいデプロイ」→「種類の選択」→「Webアプリ」
 * 4. 実行ユーザー: 自分
 *    アクセスできるユーザー: 全員
 * 5. デプロイして Web App URL を取得
 * 6. アプリ側の「通知設定」に URL を設定
 */

const GAS_TOKEN = 'fullgram-portal-token-2026';
const DEFAULT_TO_EMAIL = 'tamagon123@gmail.com';
const DRIVE_FOLDER_ID = '1y_i3qFdUqNQgPqLooP-sSVs8xXJ4XBhk';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (data.token !== GAS_TOKEN) {
      return jsonResponse({ success: false, error: 'Invalid token' });
    }

    let driveResult = null;
    if (data.saveToDrive && data.saveToDrive.filename && data.saveToDrive.content) {
      driveResult = saveToDrive(data.saveToDrive.filename, data.saveToDrive.content);
    }

    const subject = `[fullgram Portal] ${data.type || 'データ'}の${data.action || '更新'}通知`;
    const body = buildEmailBody(data, driveResult);

    GmailApp.sendEmail(
      data.to || DEFAULT_TO_EMAIL,
      subject,
      body,
      { name: 'fullgram Portal' }
    );

    return jsonResponse({ success: true, drive: driveResult });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function saveToDrive(filename, content) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const files = folder.getFilesByName(filename);

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return { updated: true, filename: filename, id: file.getId() };
  }

  const file = folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  return { created: true, filename: filename, id: file.getId() };
}

function buildEmailBody(data, driveResult) {
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

  if (data.type === 'JSONダウンロード' && !driveResult) {
    lines.push('※ ファイルは Google Drive の「_全員/提出用」フォルダへ配置してください。');
  }

  return lines.join('\n');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
