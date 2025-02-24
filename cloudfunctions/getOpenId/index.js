// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-0g0feipy52be01ff'  // 使用你的云环境ID
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
} 