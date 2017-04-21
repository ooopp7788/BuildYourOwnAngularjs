'use strict';

function parse(expr) {
    var lexer = new Lexer();
    var parser = new Parser(lexer);
    return parser.parse(expr);
}
var ESCAPES = {
    'n': '\n',
    'f': '\f',
    'r': '\r',
    't': '\t',
    'v': '\v',
    '\\': '\\',
    '\"': '\"'
};
// Lexer类
function Lexer() {

}
// 遍历text输入字符串的每个字符
Lexer.prototype.lex = function(text) {
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];
    while (this.index < this.text.length) {

        this.ch = this.text.charAt(this.index);
        // 判断的是其实位字符，只能是number和.符号，不能以- + e 开头
        if (this.isNumber(this.ch) ||
            (this.is('.') && this.isNumber(this.peek()))) {
            this.readNumber();
        } else if (this.is('\'"')) { // 判断single quote和double quote，进入readString循环
            this.readString(this.ch);
        } else if (this.is('{},[]:')) { // 判断数组和对象
            this.tokens.push({
                text: this.ch
            });
            this.index++;
        } else if (this.isIdent(this.ch)) { // 判断标识符，可能是裸露的变量，或者是已有的关键字：true false null等
            this.readIdent();
        } else if (this.isWhitespace(this.ch)) { // 判断空格
            this.index++;
        } else {
            throw 'Unexpected next character:' + this.ch;
        }
    }
    return this.tokens;
};
Lexer.prototype.readNumber = function() {
    var number = '';
    /**
     * this.index是lex循环中判断是数字的字符的index
     * 以此作为起点，来判断字符是不是数字
     */
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index).toLowerCase();
        // 是有效数字就拼接到number字符串里返回，出现非数字的部分有else中的3种情况
        if (ch === '.' || this.isNumber(ch)) {
            number += ch;
        } else {
            var nextCh = this.peek(); // 下一位字符
            var prevCh = number.charAt(number.length - 1); // 前一位字符
            // 情况一：当前字符是e，并且后一位是 - +，形成 2e-。（-后面必须跟数字，由第二种情况判断）
            if (ch === 'e' && this.isExpOperator(nextCh)) {
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)) {
                // 情况二：当前字符是 - +，且前一位是e，且后一位必须存在且是数字
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
                // 情况三：当前是- +，前一位是e，且（后一位不存在或者后一位不是数字），抛出错误，不是有效的数字
                throw "Invalid exponent";
            } else {
                // 判断不是以上情况，说明不是数字，break出循环
                break;
            }
        }
        // 检查完一位，索引值+1
        this.index++;
    }
    // number是一个read出来的数字
    this.tokens.push({
        text: number, // result Sting
        value: Number(number) // result Number
    });
};
// 把quote传入，quote是String其实点，可能是 ' 或者 " ，用于匹配结尾
Lexer.prototype.readString = function(quote) {
    this.index++; // 跳过第一个起始点字符quote
    var string = '';
    var escape = false;
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        if (escape) {
            //u0000 匹配汉字 Unicode
            if (ch === 'u') {
                var hex = this.text.substring(this.index + 1, this.index + 5);
                if (!hex.match(/[\da-f]{4}/i)) {
                    throw 'Invalid unicode escape';
                }
                this.index += 4;
                string += String.fromCharCode(parseInt(hex, 16));
            } else {
                var replacement = ESCAPES[ch];
                if (replacement) {
                    string += replacement;
                } else {
                    string += ch;
                }
            }
            escape = false;
        } else if (ch === quote) {
            // 找到了匹配quote的结尾字符，readString完成
            this.index++;
            this.tokens.push({
                text: string,
                value: string
            });
            return;
        } else if (ch === '\\') {
            // \u0000，判断unicode
            escape = true;
        } else {
            // 一般情况直接加入string
            string += ch;
        }
        this.index++;
    }
    // 如果没有return，说明quote匹配失败了
    throw 'Unmatched quote';
};
Lexer.prototype.readIdent = function() {
    var text = '';
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        if (this.isIdent(ch) || this.isNumber(ch)) {
            text += ch;
        } else {
            break;
        }
        this.index++;
    }
    var token = { text: text, identifier: true };
    this.tokens.push(token);
};
// 判断char是不是数字
Lexer.prototype.isNumber = function(ch) {
    /**
     * javascript字符串对比原则：
     * 1、有长度大于没长度
     * 2、都有长度，从首位开始逐个char比较，一旦比出大小就停止
     * 3、char比较大小原则，用char对应的charCode比较
     * *、String.charCodeAt(index);类似charAt(index)，不同的charCodeAt是返回的是该字符的charCode
     */
    return '0' <= ch && ch <= '9';
};
// 判断是否是 - + 字符
Lexer.prototype.isExpOperator = function(ch) {
    if (ch === '-' || ch === '+') {
        return true;
    }
    return false;
};

// 只允许字母 _ 和 $
Lexer.prototype.isIdent = function(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
        ch === '_' || ch === '$';
};
// 返回下一位字符
Lexer.prototype.peek = function() {
    // 如果不是最后一个元素，返回下一个元素，否则返回false
    return this.index < this.text.length - 1 ?
        this.text.charAt(this.index + 1) :
        false;
};
Lexer.prototype.isWhitespace = function(ch) {
    return ch === ' ' || ch === '\r' || ch === '\t' ||
        ch === '\n' || ch === '\v' || ch === '\u00A0';
};
// 判断元素chs是否在ch中
Lexer.prototype.is = function(chs) {
    return chs.indexOf(this.ch) >= 0;
};

/**
 * AST是一个复杂的js object结构，是一个树装的表结构；
 * 树中的每个Node都有一个type表示这个Node的句法结构；
 * 为了补充type，Node还有一个type-specific属性，保存着更多Node的信息
 * 每个 AST 都有一个root node，root node的type是AST.Program
 * @param {*} lexer AST从lex获取tokens，所以AST几乎全是操作tokens
 */
function AST(lexer) {
    this.lexer = lexer;
}
AST.Program = 'Program'; // 根节点类型
AST.Literal = 'Literal'; // 数字字符串类型
AST.ArrayExpression = 'ArrayExpression'; // 数组类型
AST.ObjectExpression = 'AST.ObjectExpression'; // 对象类型
AST.Property = 'Property'; //对象属性类型
AST.Identifier = 'Identifier';
// 储存在原型上的constants
AST.prototype.constants = {
    null: { type: AST.Literal, value: null },
    true: { type: AST.Literal, value: true },
    false: { type: AST.Literal, value: false }
};
AST.prototype.ast = function(text) {
    this.tokens = this.lexer.lex(text);
    return this.program(); // 顶部节点，称为Program Node，包含body是子节点
};
AST.prototype.program = function() {
    return {
        type: AST.Program,
        body: this.primary()
    };
};

// 所有常量储存的方法包括 number String Array等
AST.prototype.constant = function() {
    // this.consume()不传参数的时候，直接shift第一个元素
    return { type: AST.Literal, value: this.consume().value };
};
/**
 * 基础表达式，从tokens头判断出类型，然后按对应规则操作tokens
 * 1、以'['开头的按照array处理
 */
AST.prototype.primary = function() {
    if (this.expect('{')) {
        return this.object();
    } else if (this.expect('[')) {
        return this.arrayDeclaration();
    } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
        // 判断是否是预设的值，关键字。如果是，直接返回constans中对应的AST节点
        return this.constants[this.consume().text];
    } else {
        return this.constant();
    }
};
AST.prototype.object = function() {
    var properties = [];
    if (!this.peek('}')) {
        do {
            var property = { type: AST.Property };
            // key必然是constant所以直接调用this.constant()
            if (this.peek().identifier) {
                property.key = this.identifier();
            } else {
                property.key = this.constant();
            }
            this.consume(':');
            property.value = this.primary(); // value 可能是所有的类型，调用this.primary()
            properties.push(property);
        } while (this.expect(',')); //遇见','符号就shift掉，并进入循环
    }
    this.consume('}');
    return { type: AST.ObjectExpression, properties: properties };
};
AST.prototype.arrayDeclaration = function() {
    var elements = [];
    // 判断结尾不是']'字符
    if (!this.peek(']')) {
        do {
            if (this.peek(']')) {
                break;
            }
            elements.push(this.primary());
        }
        while (this.expect(','));
    }
    this.consume(']');
    return { type: AST.ArrayExpression, elements: elements };
};
// tokens中查询首位元素
AST.prototype.peek = function(e) {
    // 数组中e为分割符号',' 
    if (this.tokens.length > 0) {
        var text = this.tokens[0].text;
        if (text === e || !e) {
            return this.tokens[0];
        }
    }
};
// 如果当前元素是e或者传值为空，去掉tkoens首位元素(字符)，并返回首元素
AST.prototype.expect = function(e) {
    var token = this.peek(e);
    if (token) {
        return this.tokens.shift();
    }
};
// 判断是否是字符e
AST.prototype.consume = function(e) {
    var token = this.expect(e);
    if (!token) {
        throw 'Unexpected.Expecting:' + e;
    }
    return token;
};

// AST Compiler
function ASTCompiler(astBuilder) {
    this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
    var ast = this.astBuilder.ast(text);
    this.state = { body: [] };
    this.recurse(ast);

    /* jshint -W054 */
    return new Function(this.state.body.join(''));
    /* jshint -W054 */
};
/**
 * 接受ast树，如果是ProgramNode，递归到ast.body
 */
ASTCompiler.prototype.recurse = function(ast) {
    // 原书没有使用self = this，在_.map中使用this，导致指向出错
    var self = this;
    switch (ast.type) {
        case AST.Program:
            this.state.body.push('return ', this.recurse(ast.body), ';');
            break;
        case AST.Literal:
            return this.escape(ast.value);
        case AST.ArrayExpression:
            var elements = _.map(ast.elements, function(element) {
                return this.recurse(element);
            }, this);
            return '[' + elements.join(',') + ']';
        case AST.ObjectExpression:
            console.log('ast.p:', ast.properties)
            var properties = _.map(ast.properties, function(property) {
                var key = property.key.type === AST.Identifier ? property.key.name : self.escape(property.key.value);
                var value = self.recurse(property.value); // value可能是所有类型，需要recurse迭代
                return key + ':' + value;
            }, this);
            return '{' + properties.join(',') + '}';
    }
};
ASTCompiler.prototype.escape = function(value) {
    if (_.isString(value)) {
        return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
    } else {
        return value;
    }
};
ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
ASTCompiler.prototype.stringEscapeFn = function(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};
AST.prototype.identifier = function() {
    return { type: AST.Identifier, name: this.consume().text };
};

// Parser
function Parser(lexer) {
    this.lexer = lexer;
    this.ast = new AST(this.lexer);
    this.astCompiler = new ASTCompiler(this.ast);
}
Parser.prototype.parse = function(text) {
    return this.astCompiler.compile(text);
};