// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-0g0feipy52be01ff'  // 使用你的云环境ID
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  let updateResults = [];
  console.log('云函数开始更新预约状态，当前时间:', now);
  console.log('今天日期:', today);
  
  try {
    // 查询所有非取消和非缺席的预约
    const reservations = await db.collection('reservations')
      .where({
        status: _.neq('cancelled').and(_.neq('absent'))
      })
      .get();
    
    console.log('需要检查的预约数量:', reservations.data.length);
    
    // 处理每个预约
    for (const reservation of reservations.data) {
      let result = {
        id: reservation._id,
        originalStatus: reservation.status,
        newStatus: null,
        updated: false,
        error: null
      };
      
      const originalStatus = reservation.status;
      let newStatus = originalStatus;
      let statusDisplay = null;
      
      // 解析预约日期和时间
      const [date, timeSlots] = [reservation.date, reservation.timeSlots];
      console.log('处理预约:', reservation._id, '日期:', date, '时间段:', timeSlots);
      
      // 将日期字符串转换为日期对象进行比较
      const reservationDate = new Date(date);
      const todayDate = new Date(today);
      // 重置时间部分，只比较日期
      reservationDate.setHours(0, 0, 0, 0);
      todayDate.setHours(0, 0, 0, 0);
      
      console.log('日期比较:', 
        '预约日期:', reservationDate.toISOString(), 
        '今天日期:', todayDate.toISOString(), 
        '比较结果:', reservationDate < todayDate, reservationDate > todayDate, reservationDate.getTime() === todayDate.getTime());
      
      if (reservationDate.getTime() !== todayDate.getTime()) {
        if (reservationDate < todayDate) {
          console.log('过去的日期，标记为已完成');
          newStatus = 'completed'; // 过去日期，已完成
        } else {
          console.log('未来的日期，标记为待完成');
          newStatus = 'upcoming'; // 未来日期，待完成
        }
      } else {
        console.log('今天的预约，检查每个时间段');
        // 检查是否所有时间段都已结束
        let allSlotsCompleted = true;
        
        for (const slot of timeSlots) {
          const endTime = slot.split('-')[1];
          // 如果当前时间小于结束时间，说明这个时间段还没结束
          if (currentTime < endTime) {
            allSlotsCompleted = false;
          }
        }
        
        // 更新状态
        if (allSlotsCompleted) {
          // 所有时间段都已结束
          newStatus = 'completed';
        } else {
          // 检查是否有任何时间段已开始
          let anySlotStarted = false;
          
          for (const slot of timeSlots) {
            const startTime = slot.split('-')[0];
            if (currentTime >= startTime) {
              anySlotStarted = true;
              break;
            }
          }
          
          if (anySlotStarted) {
            // 至少有一个时间段已开始但尚未全部结束
            newStatus = 'ongoing';
          }
        }
      }
      
      result.newStatus = newStatus;
      console.log('最终状态:', newStatus, '原状态:', originalStatus);
      
      // 强制更新所有预约
      if (true) {
        console.log('更新预约状态:', reservation._id, '从', originalStatus, '到', newStatus);
        try {
          // 使用 try-catch 捕获更新操作的错误
          const updateResult = await db.collection('reservations').doc(reservation._id).update({
            data: {
              status: newStatus,
              statusDisplay: statusDisplay,
              lastUpdated: new Date() // 添加更新时间字段
            }
          });
          console.log('数据库更新结果:', JSON.stringify(updateResult));
          result.updated = true;
          
          try {
            // 验证更新是否成功
            const updated = await db.collection('reservations').doc(reservation._id).get();
            result.verificationData = updated.data;
            console.log('更新后的数据:', JSON.stringify(updated.data));
            if (updated.data.status !== newStatus) {
              console.error('更新失败，数据库中的状态未变化');
              result.error = '数据库中的状态未变化';
            }
          } catch (verifyErr) {
            console.error('验证更新失败:', verifyErr);
            result.error = '验证更新失败: ' + JSON.stringify(verifyErr);
          }
        } catch (updateErr) {
          console.error('更新操作失败:', updateErr);
          console.error('错误详情:', JSON.stringify(updateErr));
          result.error = '更新操作失败: ' + JSON.stringify(updateErr);
        }
      } else {
        console.log('状态未变化，无需更新');
      }
      
      updateResults.push(result);
    }
    
    console.log('所有更新结果:', JSON.stringify(updateResults));
    
    return {
      success: true,
      results: updateResults,
      message: '预约状态更新完成'
    };
  } catch (err) {
    console.error('更新预约状态失败:', err);
    console.error('错误详情:', JSON.stringify(err));
    return {
      success: false,
      error: err
    };
  }
} 