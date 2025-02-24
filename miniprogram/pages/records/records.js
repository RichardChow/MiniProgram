Page({
    data: {
      reservations: [],
      loading: true,
      isGettingOpenId: false,
      scrollHeight: 0
    },
  
    onShow() {
      // 获取窗口信息
      const { windowHeight } = wx.getWindowInfo();
      this.setData({
        scrollHeight: windowHeight
      });
      // 先检查是否有 openid
      const app = getApp();
      console.log('当前存储的openid:', app.globalData.userOpenId);
      
      if (app.globalData.userOpenId) {
        // 如果已有 openid，直接加载预约记录
        console.log('使用已存储的openid加载预约:', app.globalData.userOpenId);
        this.loadReservations(app.globalData.userOpenId);
      } else {
        // 如果没有 openid，先获取
        console.log('开始获取openid...');
        wx.cloud.callFunction({
          name: 'getOpenId',
          success: res => {
            const openid = res.result.openid;
            console.log('云函数获取到的openid:', openid);
            if (!openid) {
              console.error('云函数返回的openid为空');
              wx.showToast({
                title: '加载失败',
                icon: 'error'
              });
              return;
            }
            app.globalData.userOpenId = openid;
            this.loadReservations(openid);
          },
          fail: err => {
            console.error('获取openid失败，错误详情:', err);
            wx.showToast({
              title: '加载失败',
              icon: 'error'
            });
          }
        });
      }
    },
  
    // 加载预约记录
    loadReservations(openid) {
      console.log('开始加载预约记录，使用openid:', openid);
      const db = wx.cloud.database();
      this.setData({ loading: true });
  
      if (!openid) {
        console.log('没有openid，退出加载');
        this.setData({ loading: false });
        return;
      }
  
      db.collection('reservations')
        .where({
          _openid: openid  // 筛选当前用户的预约
        })
        .orderBy('createTime', 'desc')  // 按创建时间倒序排列
        .get({
          success: res => {
            console.log('查询结果:', res.data);
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
            
            console.log('处理后的预约列表:', updatedReservations);
            this.setData({
              reservations: updatedReservations,
              loading: false
            });
          },
          fail: err => {
            console.error('查询失败，错误详情:', err);
            console.error('获取预约记录失败：', err);
            wx.showToast({
              title: '加载失败',
              icon: 'error'
            });
            this.setData({ loading: false });
          }
        });
    },
  
    // 取消预约
    cancelReservation(e) {
      const { id } = e.currentTarget.dataset;
      
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
                // 使用当前用户的 openid 重新加载预约列表
                const app = getApp();
                this.loadReservations(app.globalData.userOpenId);
              },
              fail: err => {
                console.error('取消预约失败：', err);
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
      const app = getApp();
      this.loadReservations(app.globalData.userOpenId);
      wx.stopPullDownRefresh();
    }
  }); 