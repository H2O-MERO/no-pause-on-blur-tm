// ==UserScript==
// @name         防止视频因失焦和弹窗暂停
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  移除鼠标离开、失焦、隐藏时的暂停，同时检测特定按钮，防止弹窗造成的暂停
// @author       H2OMERO
// @match        https://*
// @grant        none
// ==/UserScript==

// 删除鼠标检测
document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
document.addEventListener('mouseout', e => e.stopImmediatePropagation(), true);

// 查找确定按钮
(function() {
    'use strict';

    function clickConfirm() {
        // 策略1：直接通过按钮文本来查找
        const allButtons = document.querySelectorAll('button, [role="button"], a');
        for (let btn of allButtons) {
            if (btn.textContent.trim() === '确定') {
                btn.click();
                console.log('[自动点击] 已点击“确定”按钮');
                return true;
            }
        }

        // 策略2：如果容器包含特定文字，则在其内部搜索特定按钮
        const textHints = ['视频已暂停', '其他容器元素'];
        for (let hint of textHints) {
            // 寻找所有可能包含提示文字的容器元素
            const containers = document.querySelectorAll('div, section, dialog, [role="dialog"]');
            for (let el of containers) {
                // 注意：innerText 可能会触发回流，但不会频繁调用
                if (el.innerText.includes(hint)) {
                    const confirmBtn = el.querySelector('button, [role="button"], a');
                    if (confirmBtn && confirmBtn.textContent.includes('确定')) {
                        confirmBtn.click();
                        console.log(`[自动点击] 通过“${hint}”定位到确定按钮`);
                        return true;
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

    // 页面加载完成后开始监控整个 body 的子节点和属性变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 每隔5秒也扫描一次，防止漏掉情况
    setInterval(clickConfirm, 5000);

    console.log('已启动');
})();