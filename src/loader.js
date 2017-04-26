function setupModuleLoader(window) {
    // 单例：判断对象obj上有没有name属性，没有就设置obj.name = factory()
    var ensure = function(obj, name, factory) {
        return obj[name] || (obj[name] = factory());
    };

    var angular = ensure(window, 'angular', Object);

    //创建模块，name:模块名，requires:依赖
    var createModule = function(name, requires, modules) {
        if (name === 'hasOwnProperty') {
            throw 'hasOwnProperty is not a valid module name';
        }
        var invokeQueue = [];

        // 将constant和provider等中的push方法抽出来
        var invokeLater = function(method) {
            return function() {
                invokeQueue.push([method, arguments]);
                return moduleInstance;
            };
        };

        var moduleInstance = {
            name: name,
            requires: requires,
            constant: invokeLater('constant'),
            provider: invokeLater('provider'),
            _invokeQueue: invokeQueue
        };
        // 保存已经建立的模块
        modules[name] = moduleInstance;
        return moduleInstance;
    };

    var getModule = function(name, modules) {
        if (modules.hasOwnProperty(name)) {
            return modules[name];
        } else {
            throw 'Module ' + name + 'is not available!';
        }
    };

    // angular.module = factory()也就是它返回的函数 
    ensure(angular, 'module', function() {
        var modules = {};
        // 返回的这个函数是module
        return function(name, requires) {
            // modules在函数内部被另一个函数调用，形成闭包，modules局部变量被保存在内存中
            if (requires) {
                return createModule(name, requires, modules);
            } else {
                return getModule(name, modules);
            }
        };
    });
}