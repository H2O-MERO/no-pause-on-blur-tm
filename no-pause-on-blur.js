// ==UserScript==
// @name         防止视频因失焦和弹窗暂停
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  移除鼠标离开、失焦、隐藏时的暂停，同时检测特定按钮，防止弹窗造成的暂停；策略2也使用confirmTexts列表匹配按钮
// @author       H2OMERO
// @match        https://*
// @grant        none
// ==/UserScript==

document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
document.addEventListener('mouseout', e => e.stopImmediatePropagation(), true);

(function() {
    'use strict';

    // ---- 可配置常量 ----
    // 策略1 & 策略2 共同使用的按钮文本列表（精确匹配）
    const confirmTexts = ['确定', '我知道了'];

    // 策略2：弹窗内需要包含的特征文字，满足其一即触发内部搜索
    const textHints = ['视频已暂停', '提示'];

    let pendingClick = false;

    // 生成 500~800ms 之间的随机延迟（毫秒）
    function randomDelay() {
        return Math.floor(Math.random() * 301) + 500;
    }

    /**
     * 尝试通过指定文本触发按钮点击
     * @param {HTMLElement} btn - 要点击的按钮
     * @param {string} btnText  - 按钮文本
     * @param {string} reason   - 触发原因（用于日志）
     * @returns {boolean} 是否已安排点击
     */
    function tryClickConfirmButton(btn, btnText, reason) {
        if (pendingClick) return false;
        pendingClick = true;
        const delay = randomDelay();
        setTimeout(() => {
            btn.click();
            console.log(`[自动点击] 已点击“${btnText}”按钮（${reason}），延迟${delay}ms`);
            pendingClick = false;
        }, delay);
        return true;
    }

    /**
     * 主检测与点击逻辑
     * @returns {boolean} 是否触发了一次点击安排
     */
    function clickConfirm() {
        if (pendingClick) return false; // 避免并发

        // 策略1: 全文档查找文本在 confirmTexts 中的按钮/链接
        const allButtons = document.querySelectorAll('button, [role="button"], a');
        for (const btn of allButtons) {
            const text = btn.textContent.trim();
            if (confirmTexts.includes(text)) {
                return tryClickConfirmButton(btn, text, '文本匹配');
            }
        }

        // 策略2: 查找包含特征文字的容器，内部搜索匹配 confirmTexts 的按钮
        for (const hint of textHints) {
            const containers = document.querySelectorAll('div, section, dialog, [role="dialog"]');
            for (const container of containers) {
                // 跳过不包含特征文字的容器
                if (!container.innerText.includes(hint)) continue;

                // 在容器内部查找所有可能按钮，匹配 confirmTexts
                const innerButtons = container.querySelectorAll('button, [role="button"], a');
                for (const btn of innerButtons) {
                    const btnText = btn.textContent.trim();
                    if (confirmTexts.includes(btnText)) {
                        return tryClickConfirmButton(btn, btnText, `弹窗特征“${hint}”内部匹配`);
                    }
                }
            }
        }

        return false;
    }

    // 使用 MutationObserver 实时监听 DOM 变化
    const observer = new MutationObserver(() => {
        clickConfirm();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 作为兜底，每隔5秒也扫描一次
    setInterval(clickConfirm, 5000);

    console.log('no-pause-on-blur 脚本已启动 (v0.3)');
})();
