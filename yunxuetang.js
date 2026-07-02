// ==UserScript==
// @name         云学堂o2opc全自动无人值守助手 (V14.0)
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  双模态完美融合版。有视频走内核血条，无视频（实训演示页）死守橙色倒计时，干掉所有弹窗，全自动跨章节切课。
// @author       Assistant
// @match        *://*.yunxuetang.cn/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log(`%c[云学堂助手V14.0] 智能双模全自动挂机引擎已就位...`, 'color: #00ff00; font-weight: bold;');

    const TARGET_SPEED = 2.0;
    let isClicking = false;

    // 强制突破置灰、失焦挂起
    try {
        Object.defineProperty(document, 'hidden', { get: function() { return false; }, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: function() { return 'visible'; }, configurable: true });
    } catch(e) {}
    
    const blockEvents = function(e) { e.stopImmediatePropagation(); };
    window.addEventListener('blur', blockEvents, true);
    document.addEventListener('visibilitychange', blockEvents, true);

    /**
     * 核心切课动作
     */
    function forceNavigateNext() {
        if (isClicking) return;
        isClicking = true;

        console.log('%c[状态确认] 满足完结铁律，正在执行物理切课...', 'color: #ff00ff; font-weight: bold;');

        // === 策略 1：定位右上角独立的“下一个”叶子节点 ===
        const rightTopElements = Array.from(document.querySelectorAll('button, div, span, a, i')).filter(el => {
            if (el.offsetWidth <= 0) return false;
            const rect = el.getBoundingClientRect();
            return rect.top < 100 && rect.left > (window.innerWidth - 350);
        });

        for (let el of rightTopElements) {
            if (el.children.length === 0 || (el.children.length === 1 && el.children[0].tagName === 'I')) {
                const text = (el.innerText || el.textContent || '').trim();
                if ((text === '下一个' || text === '下一节' || text.includes('下一个') || text === '下一个 >') && !text.includes('上一个')) {
                    if (!el.classList.contains('is-disabled') && !el.disabled) {
                        console.log(`[切课动作] 物理点击右上角 -> [${text}]`);
                        el.click();
                        setTimeout(() => { isClicking = false; }, 10000); // 10秒冷却防连击
                        return;
                    }
                }
            }
        }

        // === 策略 2：左侧大纲树穿透（排除已学完课时，顺位向下检索） ===
        const leftCatalog = document.querySelector('[class*="catalog"], [class*="chapter"], .培训大纲, .yxt-course-outline') || document.body;
        const items = Array.from(leftCatalog.querySelectorAll('div, li, p, a, span')).filter(el => {
            if (el.offsetWidth <= 0) return false;
            const text = el.innerText || '';
            return (text.includes('视频') || text.includes('课程') || /\d{2}\.\d{2}/.test(text)) && !text.includes('沟通') && !text.includes('分享') && !text.includes('点赞');
        });

        if (items.length > 0) {
            let currIdx = -1;
            for (let i = 0; i < items.length; i++) {
                if (items[i].classList.contains('active') || items[i].classList.contains('playing') || items[i].querySelector('[class*="active"], [class*="playing"]')) {
                    currIdx = i;
                    break;
                }
            }
            if (currIdx !== -1 && currIdx < items.length - 1) {
                for (let j = currIdx + 1; j < items.length; j++) {
                    const nextNode = items[j];
                    if (!nextNode.querySelector('[class*="check"], [class*="success"], .icon-ok') && !nextNode.innerText.includes('已完成')) {
                        console.log(`[大纲穿透] 发现下个未完结大纲任务，执行切换`);
                        const clickBtn = nextNode.querySelector('a, span') || nextNode;
                        clickBtn.click();
                        setTimeout(() => { isClicking = false; }, 10000);
                        return;
                    }
                }
            }
        }

        isClicking = false;
    }

    /**
     * 全全局环境状态巡检守护
     */
    function globalLifecycleGuard() {
        // 自动干掉“继续学习”、“切换到下一个任务提示弹窗”等打断挂机的所有干扰弹窗
        const popups = document.querySelectorAll('button, span, a, .yxt-btn, .el-button');
        popups.forEach(btn => {
            if (btn && btn.offsetWidth > 0) {
                const txt = (btn.innerText || btn.textContent || '').trim();
                if (txt === '继续学习' || txt === '确定' || txt === '知道了' || txt === '继续') {
                    console.log(`[挂机卫士] 自动处理标准拦截弹窗: [${txt}]`);
                    btn.click();
                }
            }
        });

        // 1. 获取视频标签（视频模式）
        const video = document.querySelector('video');

        // 2. 检索新版实训课特有的“橙色倒计时浮动条”（实训挂机模式）
        let countdownText = "";
        let hasCountdownBar = false;
        
        // 全局扫描带有倒计时特征的节点
        const allElements = document.querySelectorAll('div, span, p');
        for (let el of allElements) {
            if (el.offsetWidth > 0) {
                const text = el.innerText || '';
                if (text.includes('还需') && text.includes('可完成本课程学习')) {
                    countdownText = text;
                    hasCountdownBar = true;
                    break;
                }
            }
        }

        // ================= 决策树 A：如果属于实训挂机页面（无视频，有倒计时条） =================
        if (!video && hasCountdownBar) {
            // 提取出“还需 XX分钟 XX秒”里的数字
            const minuteMatch = countdownText.match(/还需\s*(\d+)\s*分钟/);
            const secondMatch = countdownText.match(/(\d+)\s*秒\s*可完成/);
            
            if (minuteMatch && secondMatch) {
                const minutes = parseInt(minuteMatch[1], 10);
                const seconds = parseInt(secondMatch[1], 10);
                
                // 只有当时间归零时，才允许切课
                if (minutes === 0 && seconds === 0) {
                    console.log('[实训模式] 倒计时已归零，解除锁定！');
                    forceNavigateNext();
                    return;
                } else {
                    // 还在安全挂机倒计时内，高亮输出状态，死不动弹
                    if (Math.random() < 0.05) { // 降低打印频率，防止刷屏
                        console.log(`[实训模式] 安全挂机中，剩余时间：${minutes}分${seconds}秒，铁律锁定中...`);
                    }
                }
            }
            return; // 实训模态下不往下走视频逻辑
        }

        // ================= 决策树 B：如果倒计时长条彻底消失了（代表实训已学完，状态转为可切换） =================
        // 如果页面原本属于实训页，且既没有视频，橙色长条也学完消失了
        if (!video && !hasCountdownBar) {
            // 检查是不是误判。通过查看是否有实训系统专属的localhost内嵌特征来双重保险
            if (document.body.innerText.includes('西北大区') || document.querySelector('iframe')) {
                console.log('[实训模式] 橙色倒计时长条已消失，判定当前实训已看满时间！');
                forceNavigateNext();
                return;
            }
        }

        // ================= 决策树 C：标准的视频播放页面 =================
        if (video) {
            // 基础托管：强制静音
            if (!video.muted) video.muted = true;

            // 强锁2倍速
            if (video.playbackRate !== TARGET_SPEED) {
                try { video.playbackRate = TARGET_SPEED; } catch(err) {}
            }

            // 防暂停自动拉起
            if (video.paused && !video.ended) {
                video.play().catch(() => {});
            }

            // 视频内核完结指标
            if (video.ended || (video.duration && video.currentTime >= video.duration - 0.4)) {
                console.log('[视频模式] 视频内核进度走完，解除锁定！');
                forceNavigateNext();
            }
        }
    }

    // 1.5秒生命巡检心跳
    setInterval(globalLifecycleGuard, 1500);

})();
