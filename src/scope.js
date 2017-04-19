/**
 * ch1 Scope
 * 忽略了watcher销毁
 */
// Scope类
function Scope() {
    this.$$watchers = []; // 观察者数组 $$b表示angular中的私有属性
    this.$$lastDirtyWatch = null; // 最后一个脏值
    this.$$asyncQuene = []; // 延迟函数的队列数组
    this.$$applyAsyncQuene = []; // 延迟$apply调用的队列数组
    this.$$applyAsyncId = null; // 追踪执行$applyAsyncQuene队列的setTimeout调用是否已经在执行
    this.$$phase = null; // scope所处的阶段，$digest $apply 或者 null
    this.$$children = []; // 子作用域
    this.$root = this; // 根作用域，在new Scope的时候建立，继承的时候不会改变它
}
// 用函数表示初始值是独一无二的，不会与任何值相等
function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
    var watcher = {
        watchFn: watchFn, // 使用函数返回值，每次获取的都是最新的newVal
        listenerFn: listenerFn || function() {}, // 
        valueEq: !!valueEq, // object、array是引用传值，对比oldVal和newVal会一直相等，使用这个标志位来标记是否比较真实值
        last: initWatchVal // 空函数，防止undefined会和默认未定义的undefined判断相等
    };
    this.$$watchers.unshift(watcher);
    this.$root.$$lastDirtyWatch = null;
    return function() {
        var index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$root.$$lastDirtyWatch = null; // 每次增加watcher时，清空$$lastDirtyWatch
        }
    };
};

/** 
 * $digest()就是脏检测的过程，对比newVal和oldVal，不相等就更新数据，并执行回调
 * 问题：何时检测，检测多少次
 */
Scope.prototype.$digest = function() {
    var dirty;
    this.$root.$$lastDirtyWatch = null;
    /**
     * 至少检测一次，看起来很完美，因为如果有watcher发生改变dirty=true，必定会再有一次循环，直至无变化。
     * 但是，问题出在哪里，如果2个watcher互相改变watch数据的值，会产生无限循环。需要一个值来限制这种情况
     */
    // do {
    //   dirty = this.$$digestOnce();
    // } while(dirty);
    var ttl = 10;
    this.$beginPhase('$digest'); // $digest阶段，调用阶段开始方法，会将'$digest'赋值给$$phase

    if (this.$root.$$applyAsyncId) {
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
        while (this.$$asyncQuene.length) {
            var asyncTask = this.$$asyncQuene.shift();
            asyncTask.scope.$eval(asyncTask.expression);
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQuene.length) && !(ttl--)) {
            this.$clearPhase(); // $digest出错，清除阶段变量
            throw "10 digest interations reached";
        }
    } while (dirty || this.$$asyncQuene.length); // 增加$$asyncQuene的长度循环条件，如果scope数据不变了，但有操作加入了一个或多个$$asyncQuene队列，会导致无法执行。

    this.$clearPhase(); // $digest结束，清除阶段变量
};

// scope执行环境
Scope.prototype.$eval = function(func, argv) {
    return func(this, argv); // func的第一个参数就是当前scope
};

// $apply方法提供一个手动执行$digest的方法
Scope.prototype.$apply = function(func) {
    try {
        this.$beginPhase('$apply'); // 增加'$apply'阶段开始标志
        this.$eval(func);
    } finally {
        this.$clearPhase(); // 在digest循环之前，清除$$phase变量
        this.$root.$digest(); // 执行$digest循环
    }
};

// $evalAsync带上执行环境（当前scope）
Scope.prototype.$evalAsync = function(expr) {
    var self = this;
    if (!self.$$phase && !self.$$asyncQuene.length) {
        setTimeout(function() {
            if (self.$$asyncQuene.length) {
                self.$root.$digest();
            }
        }, 0);
    }

    this.$$asyncQuene.push({ scope: this.scope, expression: expr });
};

Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    self.$$applyAsyncQuene.push(function() {
        self.$eval(expr);
    });
    if (self.$root.$$applyAsyncId === null) {
        self.$root.$$applyAsyncId = setTimeout(function() {
            self.$apply(function() {
                // 利用$apply，将队列中的任务全部合并成一个$apply调用，这样只会引起一次$digest
                console.log(typeof(self.$$flushApplyAsync));
                self.$apply(_.bind(self.$$flushApplyAsync, self));
            });
        }, 0);
    }
};

// 判断阶段存在与否并赋值，如果$$phase不为null，抛出错误
Scope.prototype.$beginPhase = function(phase) {
    if (this.$$phase) {
        throw this.$$phase + ' already in progress.';
    }
    this.$$phase = phase;
};

// 清空$$阶段变量
Scope.prototype.$clearPhase = function() {
    this.$$phase = null;
};

// applyAsync循环调用
Scope.prototype.$$flushApplyAsync = function() {
    while (self.$$applyAsyncQuene.length) {
        self.$$applyAsyncQuene.shift()(); // 先进先出，shift()后运行
    }
    self.$root.$$applyAsyncId = null;
};

// $digest里调用的单词循环，实际中angualr将其合并在了$digest里
Scope.prototype.$$digestOnce = function() {
    var dirty;
    var continueLoop = true;
    var self = this;
    this.$$everyScope(function(scope) {
        var newValue, oldValue;
        // scope是self的子作用域包括self本身，self是当前作用域
        _.forEachRight(scope.$$watchers, function(watcher) {
            newValue = watcher.watchFn(scope); // watchFn = function (scope) { return scope.XXX}
            oldValue = watcher.last;
            if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                scope.$root.$$lastDirtyWatch = watcher; // 如果有变化，设置最后变化的值$$lastDirtyWatch
                dirty = true; // 如果有变化，dirty = true
                watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue; // valueEq为true时，不是简单引用，而是复制这个object或array
                // 初始值
                watcher.listenerFn(newValue,
                    (oldValue === initWatchVal ? newValue : oldValue),
                    scope);
            } else if (scope.$root.$$lastDirtyWatch === watcher) {
                continueLoop = false;
                return false;
            }
        });
        return continueLoop;
    });
    return dirty; // 返回dirty状态，供$digest判断
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' &&
            isNaN(newValue) && isNaN(oldValue)); // 加入了NaN判断相等，JS中(NaN===NaN)返回false
    }
};


/**
 * ch2  Scope的继承
 */

/**
 * $new 使用JS原型继承 返回子作用域
 * angular中scope与JS作用域原则相同，查找属性时一级一级向上查找
 * watch的数据也是一样，找到就停止，所以watch能watch父作用域中不重叠的属性
 * @param {bool}    isolated    独立作用域标识
 * @param {scope}   parent      要继承的scope(父scope，默认是当前作用域this)
 * 
 */
Scope.prototype.$new = function(isolated, parent) {
    var child;
    parent = parent || this;
    // 如果是独立作用域
    if (isolated) {
        child = new Scope();
        child.$root = parent.$root; // 新建的作用域是当前作用域的独立作用域（依然是子作用域），但是失去了$root，需要手动赋值
        child.$$asyncQueue = parent.$$asyncQueue;
        child.$$postDigestQueue = parent.$$postDigestQueue;
        child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
        var ChildScope = function() {};
        ChildScope.prototype = this; // 原型继承
        child = new ChildScope();
    }
    parent.$$children.push(child); // 在当前scope上$new的独立作用域也是子作用域，只是没有继承关系
    child.$$watchers = []; // 隔离watchers
    child.$$children = [];
    return child;
};

// 递归$$children，遍历所有的child
Scope.prototype.$$everyScope = function(fn) {
    // fn(this)，遍历children执行fn，如果fn中return false就跳出循环
    if (fn(this)) {
        return this.$$children.every(function(child) {
            return child.$$everyScope(fn);
        });
    } else {
        return false;
    }
};