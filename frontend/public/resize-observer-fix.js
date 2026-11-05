// ResizeObserver错误抑制脚本
(function() {
  'use strict';
  
  // 保存原始的ResizeObserver
  const OriginalResizeObserver = window.ResizeObserver;
  
  // 创建包装的ResizeObserver
  function SafeResizeObserver(callback) {
    const safeCallback = function(entries, observer) {
      try {
        callback(entries, observer);
      } catch (error) {
        if (error.message && error.message.includes('ResizeObserver loop completed with undelivered notifications')) {
          // 静默忽略这个错误
          return;
        }
        throw error;
      }
    };
    
    return new OriginalResizeObserver(safeCallback);
  }
  
  // 复制原始ResizeObserver的所有属性和方法
  Object.setPrototypeOf(SafeResizeObserver, OriginalResizeObserver);
  Object.defineProperties(SafeResizeObserver, Object.getOwnPropertyDescriptors(OriginalResizeObserver));
  
  // 替换全局ResizeObserver
  window.ResizeObserver = SafeResizeObserver;
  
  // 添加错误事件监听器
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  });
  
  // 添加未处理的Promise拒绝监听器
  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && e.reason.message.includes('ResizeObserver')) {
      e.preventDefault();
    }
  });
})();
