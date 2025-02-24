const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-0g0feipy52be01ff'
})

exports.main = async (event, context) => {
  const db = cloud.database()
  try {
    // 删除所有预约记录
    const result = await db.collection('reservations').where({
      _id: db.command.exists(true)
    }).remove()
    
    console.log('清空数据结果：', result)
    return result
  } catch(e) {
    console.error('清空数据失败：', e)
    return e
  }
} 