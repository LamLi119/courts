import mysql from 'mysql2/promise';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GCS_BUCKET_NAME = (process.env.GCS_BUCKET_NAME || '').trim();
const WRITE_DB = String(process.env.WRITE_DB || '').trim().toLowerCase() === 'true';
const HUMAN_CHECK = String(process.env.HUMAN_CHECK || '').trim().toLowerCase() === 'true';
let gcsBucket = null;

async function resolveOrgIconColumn(pool) {
    const [rows] = await pool.execute('SHOW COLUMNS FROM venues');
    const names = new Set((rows || []).map((r) => String(r.Field || '')));
    if (names.has('orgIcon')) return 'orgIcon';
    if (names.has('org_icon')) return 'org_icon';
    return null;
}

async function askHumanCheck(venue) {
    const rl = readline.createInterface({ input, output });
    try {
        console.log(`\n🧪 Human check: venue [${venue.id}] ${venue.name}`);
        console.log('   請到 App 檢查此場館顯示是否正常。');
        console.log("   輸入 'ok' 繼續下一個、'back' 還原此場館並停止、'stop' 直接停止。");
        const answer = (await rl.question('   > ')).trim().toLowerCase();
        if (answer === 'ok') return 'ok';
        if (answer === 'back') return 'back';
        return 'stop';
    } finally {
        rl.close();
    }
}

function getGcsBucket() {
    if (!GCS_BUCKET_NAME) return null;
    if (!gcsBucket) {
        const storage = new Storage();
        gcsBucket = storage.bucket(GCS_BUCKET_NAME);
    }
    return gcsBucket;
}

function extFromMimeType(mimeType) {
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/avif') return 'avif';
    return 'bin';
}

function looksLikeImgbbUrl(input) {
    if (typeof input !== 'string') return false;
    try {
        const u = new URL(input);
        const host = (u.hostname || '').toLowerCase();
        return host.includes('imgbb.com') || host.includes('ibb.co');
    } catch (_) {
        return false;
    }
}
const certFiles = {
    ca: path.join(__dirname, 'server-ca.pem'),
    cert: path.join(__dirname, 'client-cert.pem'),
    key: path.join(__dirname, 'client-key.pem')
};

async function uploadImgbbUrlToGCS(remoteUrl, folder = 'venues') {
    const bucket = getGcsBucket();
    if (!bucket) {
        console.error('   ❌ GCS_BUCKET_NAME 未設定，無法上傳到 GCS');
        return null;
    }

    try {
        const response = await axios.get(remoteUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 300
        });
        const contentTypeRaw = String(response.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
        const mimeType = contentTypeRaw.startsWith('image/') ? contentTypeRaw : 'image/jpeg';
        const ext = extFromMimeType(mimeType);
        const random = crypto.randomBytes(6).toString('hex');
        const objectPath = `${folder}/${Date.now()}-${random}.${ext}`;
        const file = bucket.file(objectPath);
        const buffer = Buffer.from(response.data);
        await file.save(buffer, {
            contentType: mimeType,
            resumable: false,
            metadata: {
                cacheControl: 'public, max-age=31536000, immutable'
            }
        });
        return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${encodeURIComponent(objectPath).replace(/%2F/g, '/')}`;
    } catch (err) {
        console.error('   ❌ 上傳 GCS 失敗:', err.response?.data?.error?.message || err.message);
        return null;
    }
}

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST || '35.202.128.228',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'courts-db',
        ssl: {
            ca: fs.readFileSync(certFiles.ca),
            cert: fs.readFileSync(certFiles.cert),
            key: fs.readFileSync(certFiles.key),
            rejectUnauthorized: false
        }
    });

    try {
        const orgIconColumn = await resolveOrgIconColumn(pool);
        const selectOrgIconPart = orgIconColumn ? `, \`${orgIconColumn}\` AS org_icon` : ', NULL AS org_icon';
        console.log('🚀 開始從 Cloud SQL 讀取數據（ImgBB -> GCS，含 images/icon/pricing）...');
        const [venues] = await pool.execute(`SELECT id, name, images${selectOrgIconPart}, pricing FROM venues`);
        console.log(`統計：共有 ${venues.length} 個場館需要檢查。`);

        for (const venue of venues) {
            let images = venue.images;
            
            // 嘗試解析 JSON
            if (typeof images === 'string') {
                try { images = JSON.parse(images); } catch (e) { continue; }
            }

            if (!Array.isArray(images)) continue;

            const newImageUrls = [];
            let migratedCountForVenue = 0;
            let newOrgIcon = venue.org_icon;
            let orgIconMigrated = false;
            let newPricing = venue.pricing;
            let pricingMigrated = false;

            console.log(`📦 正在處理場館 [${venue.id}] ${venue.name}...`);

            for (let img of images) {
                if (looksLikeImgbbUrl(img)) {
                    console.log(`   正在搬移 ImgBB 圖片到 GCS...`);
                    const gcsUrl = await uploadImgbbUrlToGCS(img, 'venues');
                    if (gcsUrl) {
                        migratedCountForVenue += 1;
                        newImageUrls.push(gcsUrl);
                        console.log(`   ✅ 已搬移 (不更新 DB):`);
                        console.log(`      FROM: ${img}`);
                        console.log(`      TO:   ${gcsUrl}`);
                    } else {
                        newImageUrls.push(img);
                    }
                } else {
                    newImageUrls.push(img);
                }
            }

            // Process org_icon
            if (typeof venue.org_icon === 'string' && looksLikeImgbbUrl(venue.org_icon)) {
                console.log(`   正在搬移 org_icon (ImgBB -> GCS)...`);
                const gcsOrgIcon = await uploadImgbbUrlToGCS(venue.org_icon, 'org-icons');
                if (gcsOrgIcon) {
                    newOrgIcon = gcsOrgIcon;
                    orgIconMigrated = true;
                    console.log(`   ✅ org_icon 已搬移:`);
                    console.log(`      FROM: ${venue.org_icon}`);
                    console.log(`      TO:   ${gcsOrgIcon}`);
                }
            }

            // Process pricing.imageUrl
            if (venue.pricing != null && venue.pricing !== '') {
                let pricingObj = venue.pricing;
                let pricingIsString = false;
                if (typeof venue.pricing === 'string') {
                    try {
                        pricingObj = JSON.parse(venue.pricing);
                        pricingIsString = true;
                    } catch (_) {
                        pricingObj = null;
                    }
                }

                if (pricingObj && typeof pricingObj === 'object') {
                    const imageUrl = typeof pricingObj.imageUrl === 'string' ? pricingObj.imageUrl : '';
                    if (looksLikeImgbbUrl(imageUrl)) {
                        console.log(`   正在搬移 pricing.imageUrl (ImgBB -> GCS)...`);
                        const gcsPricing = await uploadImgbbUrlToGCS(imageUrl, 'pricing');
                        if (gcsPricing) {
                            pricingObj = { ...pricingObj, imageUrl: gcsPricing };
                            newPricing = pricingIsString ? JSON.stringify(pricingObj) : pricingObj;
                            pricingMigrated = true;
                            console.log(`   ✅ pricing.imageUrl 已搬移:`);
                            console.log(`      FROM: ${imageUrl}`);
                            console.log(`      TO:   ${gcsPricing}`);
                        }
                    }
                }
            }

            const shouldUpdateImages = migratedCountForVenue > 0;
            const shouldUpdateVenue = shouldUpdateImages || orgIconMigrated || pricingMigrated;

            if (shouldUpdateVenue) {
                if (WRITE_DB) {
                    const imagesForDb = shouldUpdateImages ? JSON.stringify(newImageUrls) : venue.images;
                    if (orgIconColumn) {
                        await pool.execute(
                            `UPDATE venues SET images = ?, \`${orgIconColumn}\` = ?, pricing = ? WHERE id = ?`,
                            [imagesForDb, newOrgIcon, newPricing, venue.id]
                        );
                    } else {
                        await pool.execute(
                            'UPDATE venues SET images = ?, pricing = ? WHERE id = ?',
                            [imagesForDb, newPricing, venue.id]
                        );
                    }
                    console.log(
                        `   ✅ 已更新 DB（images: ${migratedCountForVenue}、org_icon: ${orgIconMigrated ? 1 : 0}、pricing: ${pricingMigrated ? 1 : 0}）`
                    );

                    if (HUMAN_CHECK) {
                        const action = await askHumanCheck(venue);
                        if (action === 'ok') {
                            console.log('   👍 已確認，繼續下一個場館。');
                        } else if (action === 'back') {
                            if (orgIconColumn) {
                                await pool.execute(
                                    `UPDATE venues SET images = ?, \`${orgIconColumn}\` = ?, pricing = ? WHERE id = ?`,
                                    [venue.images, venue.org_icon, venue.pricing, venue.id]
                                );
                            } else {
                                await pool.execute(
                                    'UPDATE venues SET images = ?, pricing = ? WHERE id = ?',
                                    [venue.images, venue.pricing, venue.id]
                                );
                            }
                            console.log('   ↩️ 已還原此場館到變更前狀態，流程停止。');
                            break;
                        } else {
                            console.log('   ⏹️ 已停止流程（不還原剛才變更）。');
                            break;
                        }
                    }
                } else {
                    console.log(
                        `   ℹ️ 已搬移到 GCS（images: ${migratedCountForVenue}、org_icon: ${orgIconMigrated ? 1 : 0}、pricing: ${pricingMigrated ? 1 : 0}，未更新 DB）`
                    );
                }
            } else {
                console.log(`   ⏩ 無需更新 (images/icon/pricing 都非 ImgBB 或無資料)`);
            }
        }

        if (WRITE_DB) {
            if (HUMAN_CHECK) {
                console.log('\n✨ ImgBB -> GCS 處理完成（human check 模式）。');
            } else {
                console.log('\n✨ ImgBB -> GCS 搬移完成！（未刪除 ImgBB 圖片，已更新 DB URL，未改資料表結構）');
            }
        } else {
            console.log('\n✨ ImgBB -> GCS 搬移完成！（未刪除 ImgBB 圖片，未更新 DB，未改資料表結構）');
        }
    } catch (err) {
        console.error('❌ 遷移過程中出錯:', err);
    } finally {
        await pool.end();
    }
}

migrate();