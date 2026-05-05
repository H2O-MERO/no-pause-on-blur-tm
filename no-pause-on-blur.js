// ==UserScript==
// @name         防止视频因失焦和弹窗而被暂停
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  移除鼠标离开、失焦、隐藏时的暂停，同时检测特定按钮，防止弹窗造成的暂停，同时使窗口保持活跃。
// @author       H2OMERO
// @match        https://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ---- 可配置常量 ----
    // 策略1 & 策略2 共同使用的按钮文本列表（精确匹配）
    const CONFIRM_TEXTS = ['确定', '我知道了'];

    // 策略2：弹窗内需要包含的特征文字，满足其一即触发内部搜索
    const HINT_TEXTS = ['视频已暂停', '提示'];

    // 页面活跃伪装
    function overrideVisibilityAPI() {
        try {
            // 始终显示为活跃
            Object.defineProperty(document, 'hidden', {
                get: () => false,
                configurable: false,
                enumerable: true
            });
        } catch(e) {}

        try {
            // 始终显示为可视状态
            Object.defineProperty(document, 'visibilityState', {
                get: () => 'visible',
                configurable: false,
                enumerable: true
            });
        } catch(e) {}

        try {
            // 始终认为窗口拥有焦点
            document.hasFocus = () => true;
        } catch(e) {}
    }
    overrideVisibilityAPI();

    // 在捕获阶段阻止 visibilitychange / blur / mouseout 事件传播
    const blockedEvents = ['visibilitychange', 'blur', 'mouseout'];
    blockedEvents.forEach(evt => {
        document.addEventListener(evt, e => e.stopImmediatePropagation(), true);
        window.addEventListener(evt, e => e.stopImmediatePropagation(), true);
    });


    // 关闭暂停弹窗
    let pendingClick = false;

    function randomDelay() {
        // 500~800延迟点击ms
        return Math.floor(Math.random() * 301) + 500;
    }

    // 新增：自动寻找并播放视频
    function resumeAllVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.paused) {
                video.play().catch(err => {
                    // 个别环境可能不允许自动播放，静音后重试
                    if (err.name === 'NotAllowedError') {
                        video.muted = true;
                        video.play().catch(() => {});
                    }
                });
            }
        });
    }

    function tryClickConfirmButton(btn, btnText, reason) {
        if (pendingClick) return false;
        pendingClick = true;
        const delay = randomDelay();
        setTimeout(() => {
            btn.click();
            console.log(`[自动点击] 已点击“${btnText}”按钮（${reason}），延迟${delay}ms`);
            // 点击后延迟寻找视频并播放（多次延迟以应对弹窗关闭动画或视频元素延迟加载）
            setTimeout(resumeAllVideos, 500);
            setTimeout(resumeAllVideos, 2000);
            pendingClick = false;
        }, delay);
        return true;
    }

    function clickConfirm() {
        if (pendingClick) return false;

        // 策略1：全文档搜索文本匹配的按钮/链接
        const allButtons = document.querySelectorAll('button, [role="button"], a');
        for (const btn of allButtons) {
            const text = btn.textContent.trim();
            if (CONFIRM_TEXTS.includes(text)) {
                return tryClickConfirmButton(btn, text, '直接文本匹配');
            }
        }

        // 策略2：在包含特征文字的容器内搜索匹配按钮
        for (const hint of HINT_TEXTS) {
            const containers = document.querySelectorAll('div, section, dialog, [role="dialog"]');
            for (const container of containers) {
                if (!container.innerText.includes(hint)) continue;

                const innerBtns = container.querySelectorAll('button, [role="button"], a');
                for (const btn of innerBtns) {
                    const btnText = btn.textContent.trim();
                    if (CONFIRM_TEXTS.includes(btnText)) {
                        return tryClickConfirmButton(btn, btnText, `弹窗特征“${hint}”内部匹配`);
                    }
                }
            }
        }

        return false;
    }

    function startObserver() {
        if (!document.body) {
            requestAnimationFrame(startObserver);
            return;
        }

        const observer = new MutationObserver(() => clickConfirm());
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 定期兜底扫描（防止某些动态场景遗漏）
        setInterval(clickConfirm, 5000);

        console.log('[no-pause-on-blur] 脚本已启动（活跃伪装+弹窗自动关闭）');
    }

    // 根据当前文档状态决定启动时机
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

})();
