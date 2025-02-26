const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-0g0feipy52be01ff'
})

exports.main = async (event, context) => {
  const db = cloud.database()
  try {
    // 删除所有预约记录
    const reservationsResult = await db.collection('reservations').where({
      _id: db.command.exists(true)
    }).remove()
    
    // 删除所有限制用户记录
    const restrictedUsersResult = await db.collection('restrictedUsers').where({
      _id: db.command.exists(true)
    }).remove()
    
    console.log('清空预约记录结果：', reservationsResult)
    console.log('清空限制用户结果：', restrictedUsersResult)
    
    return {
      reservations: reservationsResult,
      restrictedUsers: restrictedUsersResult,
      success: true
    }
  } catch(e) {
    console.error('清空数据失败：', e)
    return e
  }
} 