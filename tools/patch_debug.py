# -*- coding: utf-8 -*-
"""为所有云函数入口增加 __debug 错误明细返回，便于联机排障"""
import io
import os
import re

DOMAINS = ['auth', 'user', 'learn', 'contest', 'announce', 'social', 'agent']

# 匹配: return fail('服务异常，请稍后重试', 500);
pattern = re.compile(r"return fail\('服务异常，请稍后重试', 500\);")
replacement = (
    "// __debug=true 时返回真实错误，便于联机排障\n"
    "    const detail = event.__debug ? String((err && err.message) || err) : '服务异常，请稍后重试';\n"
    "    return fail(detail, 500);"
)

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for d in DOMAINS:
    path = os.path.join(base, 'cloudfunctions', d, 'index.js')
    src = io.open(path, encoding='utf-8').read()
    new, count = pattern.subn(replacement, src)
    if count:
        io.open(path, 'w', encoding='utf-8').write(new)
        print('patched:', d)
    else:
        print('skip:', d)
