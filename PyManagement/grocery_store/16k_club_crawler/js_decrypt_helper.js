/**
 * JavaScript解密辅助工具
 * 用于在Node.js环境中执行常见的小说网站JS解密
 * 包含：AES解密、Base64解码、常见混淆还原
 */

const CryptoJS = require('crypto-js');

/**
 * 常见AES解密函数
 * @param {string} encrypted 加密内容
 * @param {string} key 密钥
 * @param {string} iv 初始向量
 * @param {string} mode 模式 ECB/CBC
 */
function aesDecrypt(encrypted, key, iv = '', mode = 'ECB') {
    try {
        const keyBytes = CryptoJS.enc.Utf8.parse(key);
        const cfg = {
            mode: mode === 'CBC' ? CryptoJS.mode.CBC : CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        };

        if (mode === 'CBC' && iv) {
            cfg.iv = CryptoJS.enc.Utf8.parse(iv);
        }

        const decrypted = CryptoJS.AES.decrypt(encrypted, keyBytes, cfg);
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error('AES解密失败:', e.message);
        return null;
    }
}

/**
 * Base64解码
 */
function base64Decode(str) {
    try {
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {
        return null;
    }
}

/**
 * Unicode解码
 */
function unicodeDecode(str) {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    });
}

/**
 * 十六进制解码
 */
function hexDecode(str) {
    return str.replace(/\\x([0-9a-fA-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    });
}

/**
 * 常见的字符映射还原
 * 处理网站的错字替换反爬
 */
const charReplaceMap = {
    // 可根据实际网站扩展
    '的': '的', '了': '了', '是': '是',
    // 数字映射
    '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
    '五': '5', '六': '6', '七': '7', '八': '8', '九': '9'
};

function restoreChars(text, customMap = {}) {
    const map = { ...charReplaceMap, ...customMap };
    let result = text;
    for (const [k, v] of Object.entries(map)) {
        result = result.split(k).join(v);
    }
    return result;
}

/**
 * 处理eval/packer混淆
 */
function unpack(encoded) {
    try {
        // 简单的packer解包
        if (encoded.includes('eval(function(p,a,c,k,e,d)')) {
            return eval(encoded.replace('eval', ''));
        }
        return encoded;
    } catch (e) {
        return encoded;
    }
}

/**
 * 自动检测并解密内容
 */
function autoDecrypt(content, hints = {}) {
    let result = content;

    // 尝试十六进制解码
    if (result.includes('\\x')) {
        result = hexDecode(result);
    }

    // 尝试Unicode解码
    if (result.includes('\\u')) {
        result = unicodeDecode(result);
    }

    // 尝试Base64解码（如果看起来像Base64）
    if (hints.base64 || /^[A-Za-z0-9+/=]{50,}$/.test(result.trim())) {
        const decoded = base64Decode(result.trim());
        if (decoded && decoded.length > 20 && hasChinese(decoded)) {
            result = decoded;
        }
    }

    // 尝试AES解密（如果提供了密钥）
    if (hints.aesKey) {
        const decrypted = aesDecrypt(
            result,
            hints.aesKey,
            hints.aesIv || '',
            hints.aesMode || 'ECB'
        );
        if (decrypted && decrypted.length > 20) {
            result = decrypted;
        }
    }

    return result;
}

function hasChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
}

// 命令行接口
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('用法:');
        console.log('  node js_decrypt_helper.js <命令> [参数...]');
        console.log('');
        console.log('命令:');
        console.log('  aes <encrypted> <key> [iv] [mode]  - AES解密');
        console.log('  base64 <encoded>                   - Base64解码');
        console.log('  unpack <packed_js>                 - 解包eval/packer混淆');
        console.log('');
        console.log('示例:');
        console.log('  node js_decrypt_helper.js aes "U2FsdGVkX1..." "mykey123" "" ECB');
        process.exit(0);
    }

    const cmd = args[0];

    switch (cmd) {
        case 'aes':
            const [encrypted, key, iv = '', mode = 'ECB'] = args.slice(1);
            console.log(aesDecrypt(encrypted, key, iv, mode));
            break;
        case 'base64':
            console.log(base64Decode(args[1]));
            break;
        case 'unpack':
            const fs = require('fs');
            const packed = fs.readFileSync(args[1], 'utf-8');
            console.log(unpack(packed));
            break;
        default:
            console.log('未知命令:', cmd);
    }
}

module.exports = {
    aesDecrypt,
    base64Decode,
    unicodeDecode,
    hexDecode,
    restoreChars,
    unpack,
    autoDecrypt
};
