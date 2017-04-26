/* jshint globalstrict: true */
/* global createInjector: false, setupModuleLoader: false, angular: false */
'use strict';

describe('injector', function() {
    beforeEach(function() {
        delete window.angular;
        setupModuleLoader(window);
    });

    it('has a constant that has been registered to a module', function() {

        var module = angular.module('myModule', []);
        module.constant('aConstant', 42);
        var injector = createInjector(['myModule']);
        expect(injector.has('aConstant')).toBe(true);
    });

    it('does not allow a constant called hasOwnProperty', function() {
        var module = angular.module('myModule', []);
        module.constant('hasOwnProperty', _.constant(false));
        expect(function() {
            createInjector(['myModule']);
        }).toThrow();
    });

    it('loads each module only once ', function() {
        angular.module('myModule', ['myOtherModule']);
        angular.module('myOtherModule', ['myModule']);
        createInjector(['myModule']);
    });

    it('invokes an annotated function with dependency injection', function() {
        var module = angular.module('myModule', []);
        module.constant('a', 1);
        module.constant('b', 2);
        var injector = createInjector(['myModule']);
        var fn = function(one, two) { return one + two; };
        fn.$inject = ['a', 'b'];
        expect(injector.invoke(fn)).toBe(3);
    });

    it('overrides dependencies with locals when invoking', function() {
        var module = angular.module('myModule', []);
        module.constant('a', 1);
        module.constant('b', 2);
        var injector = createInjector(['myModule']);
        var fn = function(one, two) { return one + two; };
        fn.$inject = ['a', 'b'];
        expect(injector.invoke(fn, undefined, { b: 3 })).toBe(4);
    });


});

describe('annotate', function() {
    it('returns the $inject annotation of a function when it has one ', function() {
        var injector = createInjector([]);
        var fn = function() {};
        fn.$inject = ['a', 'b'];
        expect(injector.annotate(fn)).toEqual(['a', 'b']);
    });

    it('returns the array - style annotations of a function ', function() {
        var injector = createInjector([]);
        var fn = ['a', 'b', function() {}];
        expect(injector.annotate(fn)).toEqual(['a', 'b']);
    });

    it('returns the array-style annotations of a function ', function() {
        var injector = createInjector([]);
        var fn = ['a', 'b', function() {}];
        expect(injector.annotate(fn)).toEqual(['a', 'b']);
    });

    it('invokes an array-annotated function with dependency injection', function() {
        var module = angular.module('myModule', []);
        module.constant('a', 1);
        module.constant('b', 2);
        var injector = createInjector(['myModule']);
        var fn = ['a', 'b', function(one, two) { return one + two; }];
        expect(injector.invoke(fn)).toBe(3);
    });

    it('instantiates an annotated constructor function', function() {
        var module = angular.module('myModule', []);
        module.constant('a', 1);
        module.constant('b', 2);
        var injector = createInjector(['myModule']);

        function Type(one, two) {
            this.result = one + two;
        }
        Type.$inject = ['a', 'b'];
        var instance = injector.instantiate(Type);
        expect(instance.result).toBe(3);
    });

    // 再此之前，都只能用module.constant来储存数据，constant类似于set方法，往invokeueue中增加数据
    // 增加 provider方法

    it('injects the $get method of a provider', function() {
        var module = angular.module('myModule', []);
        module.constant('a', 1);
        module.provider('b', {
            $get: function(a) {
                return a + 2;
            }
        });
        var injector = createInjector(['myModule']);
        expect(injector.get('b')).toBe(3);
    });

    it('injects the $get method of a provider lazily', function() {
        var module = angular.module('myModule', []);
        module.provider('b', {
            $get: function(a) {
                return a + 2;
            }
        });
        module.provider('a', { $get: _.constant(1) });
        var injector = createInjector(['myModule']);
        expect(injector.get('b')).toBe(3);
    });

    it('instantiates a dependency only once', function() {
        var module = angular.module('myModule', []);
        module.provider('a', { $get: function() { return {}; } });
        var injector = createInjector(['myModule']);
        expect(injector.get('a')).toBe(injector.get('a'));
    });

    it('notifies the user about a circular dependency', function() {
        var module = angular.module('myModule', []);
        /**
         * 流程：
         * 1、创建模块module = angular.module('myModule')，返回moduleInstance实例
         * 2、module.provider是实例中的一个方法，这个方法会往invokeQueue里push['provider', arguments] 其中arguments传入的参数类数组
         * 3、调用module.provider('a',{$get:function(b){}})时，invokeQueue=[['provider', ['a',{ $get: function(b){}}]] ]
         * 4、createInjector(['myModule'])时，遍历invokeQueue，单个元素也是数组，第一个元素作为method，第二个元素作为argv
         * 5、调用$provide[method].apply($provide, argv)，实际$provide.provide('a',[{ $get: function(b){}}]);providerCache['aProvider'] = {$get:function(){}}
         * 6、最后调用 injector.get('a')，
         * 7、实际是getService('a')，provider = providerCache['aProvider'] = { $get: function(b){}}
         * 8、返回instance = instanceCache['a'] = invoke(fn = provider.$get)
         * 9、invoke(fn)，当fn是个函数时，会提取出fn中的参数deps，getService(deps)，回到 <流程7> 获取 a 的依赖服务 b
         */
        module.provider('a', { $get: function(b) {} });
        module.provider('b', { $get: function(c) {} });
        module.provider('c', { $get: function(a) {} });
        var injector = createInjector(['myModule']);
        expect(function() {
            injector.get('a');
        }).toThrowError(/Circular dependency found/);
    });
});