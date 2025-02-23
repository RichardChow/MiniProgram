Page({
    data: {
      reservations: [],
      loading: true
    },
  
    onShow() {
      this.loadReservations();
    },
  
    // 加载预约记录
    loadReservations() {
      const db = wx.cloud.database();
      this.setData({ loading: true });
  
      db.collection('reservations')
        .orderBy('createTime', 'desc')  // 按创建时间倒序排列
        .get({
          success: res => {
            // 获取当前时间
            const now = new Date();
            
            // 处理每个预约的状态
            const updatedReservations = res.data.map(reservation => {
              // 如果已取消，保持取消状态
              if (reservation.status === 'cancelled') {
                return reservation;
              }
              
              // 解析预约日期和时间
              const [date, timeSlots] = [reservation.date, reservation.timeSlots];
              
              // 获取最早和最晚的时间点
              const firstTime = timeSlots[0].split('-')[0];
              const lastTime = timeSlots[timeSlots.length - 1].split('-')[1];
              
              // 构建完整的日期时间
              const startTime = new Date(`${date} ${firstTime}`);
              const endTime = new Date(`${date} ${lastTime}`);
              
              // 更新状态
              if (now < startTime) {
                reservation.status = 'upcoming';  // 未开始
              } else if (now >= startTime && now <= endTime) {
                reservation.status = 'ongoing';   // 进行中
              } else {
                reservation.status = 'completed'; // 已完成
              }
              
              return reservation;
            });
            
            this.setData({
              reservations: updatedReservations,
              loading: false
            });
            
            // 批量更新数据库中的状态
            updatedReservations.forEach(reservation => {
              db.collection('reservations').doc(reservation._id).update({
                data: {
                  status: reservation.status
                }
              }).catch(err => {
                console.error('更新预约状态失败：', err);
              });
            });
          },
          fail: err => {
            console.error('获取预约记录失败：', err);
            console.error('错误详情：', err);
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
            this.setData({ loading: false });
          }
        });
    },
  
    // 取消预约
    cancelReservation(e) {
      const { id } = e.currentTarget.dataset;
      console.log('要取消的预约ID：', id);
      
      wx.showModal({
        title: '提示',
        content: '确定要取消这个预约吗？',
        success: (res) => {
          if (res.confirm) {
            const db = wx.cloud.database();
            db.collection('reservations').doc(id).update({
              data: {
                status: 'cancelled'
              },
              success: () => {
                wx.showToast({
                  title: '取消成功',
                  icon: 'success'
                });
                this.loadReservations();  // 重新加载预约列表
              },
              fail: err => {
                console.error('取消预约失败：', err);
                console.error('取消失败详情：', err);
                wx.showToast({
                  title: '取消失败',
                  icon: 'error'
                });
              }
            });
          }
        }
      });
    },
  
    // 下拉刷新
    onPullDownRefresh() {
      this.loadReservations();
      wx.stopPullDownRefresh();
    }
  }); 