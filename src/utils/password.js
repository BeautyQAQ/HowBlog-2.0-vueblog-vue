export function validateNewPassword(rule, value, callback) {
  if (!value) {
    callback()
    return
  }
  if (!value.trim()) {
    callback(new Error('密码不能为纯空白'))
    return
  }
  // Java 的 String.length() 与 JavaScript 一样按 UTF-16 代码单元计数。
  if (value.length < 8 || value.length > 64) {
    callback(new Error('密码长度须为 8 到 64 个字符'))
    return
  }
  if (new TextEncoder().encode(value).length > 72) {
    callback(new Error('密码的 UTF-8 编码不能超过 72 字节，请减少中文或表情等字符'))
    return
  }
  callback()
}
