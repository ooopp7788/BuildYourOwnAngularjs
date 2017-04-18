// Scope类
function Scope() {
  this.$$watchers = [];    // 观察者数组 $$b表示angular中的私有属性
  this.$$lastDirtyWatch = null;   // 最后一个脏值
  this.$$asyncQuene = [];         // 延迟函数的队列数组
  this.$$applyAsyncQuene = [];    // 延迟$apply调用的队列数组
  this.$$phase = null;            // scope所处的阶段，$digest $apply 或者 null
}
// 用函数表示初始值是独一无二的，不会与任何值相等
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
  this.$beginPhase('$digest');         // $digest阶段，调用阶段开始方法，会将'$digest'赋值给$$phase
  do {
    while(this.$$asyncQuene.length) {
      var asyncTask = this.$$asyncQuene.shift();
      asyncTask.scope.$eval(asyncTask.expression);
    }
    dirty = this.$$digestOnce();
    if ((dirty|| this.$$asyncQuene.length) && !(ttl--)){
      this.$clearPhase();              // $digest出错，清除阶段变量
      throw "10 digest interations reached";
    }
  } while(dirty || this.$$asyncQuene.length);         // 增加$$asyncQuene的长度循环条件，如果scope数据不变了，但有操作加入了一个或多个$$asyncQuene队列，会导致无法执行。

  this.$clearPhase();                  // $digest结束，清除阶段变量
};

// scope执行环境
Scope.prototype.$eval = function (func, argv) {
  return func(this, argv);            // func的第一个参数就是当前scope
};

// $apply方法提供一个手动执行$digest的方法
Scope.prototype.$apply = function (func) {
  try {
    this.$beginPhase('$apply');       // 增加'$apply'阶段开始标志
    this.$eval(func);
  } finally {
    this.$clearPhase();               // 在digest循环之前，清除$$phase变量
    this.$digest();                   // 执行$digest循环
  }
};

// $evalAsync带上执行环境（当前scope）
Scope.prototype.$evalAsync = function (expr) {
  var self = this;
  if (!self.$$phase && !self.$$asyncQuene.length) {
    setTimeout(function() {
      if (self.$$asyncQuene.length) {
        self.$digest();
      }
    }, 0);
  }

  this.$$asyncQuene.push({scope:this.scope, expression: expr});
};

Scope.prototype.$applyAsync = function (expr) {
  var self = this;
  self.$$applyAsyncQuene.push(function(){
    self.$eval(expr);
  });
  setTimeout(function () {
    self.$apply(function () {
      // 利用$apply，将队列中的任务全部合并成一个$apply调用，这样只会引起一次$digest
      while(self.$$applyAsyncQuene.length){   
        self.$$applyAsyncQuene.shift()();     // 先进先出，shift()后运行
      }
    });
  },0);
};

// 判断阶段存在与否并赋值，如果$$phase不为null，抛出错误
Scope.prototype.$beginPhase = function (phase) {
  if(this.$$phase){
    throw this.$$phase + 'already in progress.';
  }
  this.$$phase = phase;
};

// 清空$$阶段变量
Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};

// $digest里调用的单词循环，实际中angualr将其合并在了$digest里
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
        isNaN(newValue) && isNaN(oldValue));            // 加入了NaN判断相等，JS中(NaN===NaN)返回false
  }
};