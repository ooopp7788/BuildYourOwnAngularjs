function Scope() {
  this.$$watchers = [];    // 观察者数组 $$b表示angular中的私有属性
  this.$$lastDirtyWatch = null;   // 最后一个脏值
}
function initWatchVal () {}

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
  var watcher = {
    watchFn: watchFn,                         // 使用函数返回值，每次获取的都是最新的newVal
    listenerFn: listenerFn || function(){},   // 
    valueEq: !!valueEq,                       // object、array是引用传值，对比oldVal和newVal会一直相等，使用这个标志位来标记是否比较真实值
    last: initWatchVal                        // 空函数，防止undefined会和默认未定义的undefined判断相等
  };
  this.$$watchers.push(watcher);
  this.$$lastDirtyWatch = null;               // 每次增加watcher时，清空$$lastDirtyWatch
};

/** 
 * $digest()就是脏检测的过程，对比newVal和oldVal，不相等就更新数据，并执行回调
 * 问题：何时检测，检测多少次
 */
Scope.prototype.$digest = function () {
  var dirty;
  this.$$lastDirtyWatch = null;
  /**
   * 至少检测一次，看起来很完美，因为如果有watcher发生改变dirty=true，必定会再有一次循环，直至无变化。
   * 但是，问题出在哪里，如果2个watcher互相改变watch数据的值，会产生无限循环。需要一个值来限制这种情况
   */
  // do {
  //   dirty = this.$$digestOnce();
  // } while(dirty);
  var ttl = 10;
  do {
    dirty = this.$$digestOnce();
    if (dirty && !(ttl--)){
      throw "10 digest interations reached";
    }
  } while(dirty);
};

Scope.prototype.$$digestOnce = function () {
  var dirty;
  var self = this;  // self 就是 scope
  var newValue, oldValue;
  // 变化后回调
  _.forEach(this.$$watchers, function(watcher){
    newValue = watcher.watchFn(self);                 // watchFn = function (scope) { return scope.XXX}
    oldValue = watcher.last;
    if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)){
      self.$$lastDirtyWatch = watcher;                // 如果有变化，设置最后变化的值$$lastDirtyWatch
      dirty = true;                                   // 如果有变化，dirty = true
      watcher.last = watcher.valueEq?_.cloneDeep(newValue):newValue; // valueEq为true时，不是简单引用，而是复制这个object或array
      // 初始值
      watcher.listenerFn(newValue,
        (oldValue === initWatchVal? newValue: oldValue),
        self);
    } else if (self.$$lastDirtyWatch === watcher) { 
      return false;
    }
  });
  return dirty;                                       // 返回dirty状态，供$digest判断
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) { 
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||(typeof newValue === 'number' && typeof oldValue === 'number' &&
        isNaN(newValue) && isNaN(oldValue));
  }
};