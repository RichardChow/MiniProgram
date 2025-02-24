Page({
  data: {
    isLoggedIn: false,
    showLoginModal: true,
    password: '',
    showPassword: false,  // 控制密码是否可见
    reservations: [],
    loading: true,
    currentDate: '',
    dateList: [],
    filterStatus: 'all', // all, upcoming, ongoing, completed, cancelled
    upcomingCount: 0,
    ongoingCount: 0,
    completedCount: 0,
    totalCount: 0
  },

  onLoad() {
    const isLoggedIn = wx.getStorageSync('adminLoggedIn') || false;
    this.setData({
      isLoggedIn,
      showLoginModal: !isLoggedIn
    });
    
    if (this.data.isLoggedIn) {
      this.initDateList();  // 先初始化日期列表
      const today = new Date().toISOString().split('T')[0];  // 获取今天的日期
      this.loadStatistics(today);  // 加载今天的统计数据
      this.loadReservations(this.data.filterStatus, today);  // 加载今天的预约记录
    }
    this.cleanExpiredData();
  },

  onShow() {
    const isLoggedIn = wx.getStorageSync('adminLoggedIn') || false;
    this.setData({
      isLoggedIn,
      showLoginModal: !isLoggedIn
    });

    if (isLoggedIn) {
      // 每次显示页面时重置为当天日期
      const today = new Date().toISOString().split('T')[0];
      this.initDateList();
      this.setData({
        currentDate: today,
        filterStatus: 'all'  // 重置状态筛选为"全部"
      });
      // 重新加载数据
      this.loadStatistics(today);
      this.loadReservations('all', today);
    }
  },

  // 密码相关方法
  togglePasswordVisibility() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  handleLogin() {
    const { password } = this.data;
    if (password === 'hjpp12345') {
      wx.setStorageSync('adminLoggedIn', true);
      
      this.setData({
        isLoggedIn: true,
        showLoginModal: false,
        password: ''
      });

      const today = new Date().toISOString().split('T')[0];
      this.initDateList();
      this.loadStatistics(today);
      this.loadReservations(this.data.filterStatus, today);

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '密码错误',
        icon: 'error'
      });
    }
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('adminLoggedIn');
          
          this.setData({
            isLoggedIn: false,
            showLoginModal: true
          });

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  // 日期相关方法
  initDateList() {
    const dates = [];
    const today = new Date();
    
    for(let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    this.setData({
      dateList: dates,
      currentDate: today.toISOString().split('T')[0]
    });
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      currentDate: date
    });
    // 更新统计数据和预约列表
    this.loadStatistics(date);
    this.loadReservations(this.data.filterStatus, date);
  },

  // 加载统计数据
  loadStatistics(date = '') {
    const db = wx.cloud.database();
    let query = {};
    if (date) {
      query.date = date;
    }

    db.collection('reservations')
      .where(query)
      .get()
      .then(res => {
        const allReservations = res.data;
        // 更新统计数据（这个不会随状态筛选变化）
        this.setData({
          upcomingCount: allReservations.filter(r => r.status === 'upcoming').length,
          ongoingCount: allReservations.filter(r => r.status === 'ongoing').length,
          completedCount: allReservations.filter(r => r.status === 'completed').length,
          totalCount: allReservations.length
        });
      });
  },

  // 加载预约记录
  loadReservations(status = 'all', date = '') {
    const db = wx.cloud.database();
    this.setData({ loading: true });

    // 构建查询条件
    let query = {};
    if (date) {
      query.date = date;
    }
    if (status !== 'all') {
      query.status = status;
    }

    // 获取筛选后的预约记录
    db.collection('reservations')
      .where(query)
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
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

        // 更新数据库中的状态
        updatedReservations.forEach(reservation => {
          db.collection('reservations').doc(reservation._id).update({
            data: {
              status: reservation.status
            }
          }).catch(err => {
            console.error('更新预约状态失败：', err);
          });
        });

        // 更新显示
        this.setData({
          reservations: updatedReservations,
          loading: false
        });
      })
      .catch(err => {
        console.error('获取数据失败：', err);
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        });
        this.setData({ loading: false });
      });
  },

  // 状态切换
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      filterStatus: status
    });
    // 只更新预约列表，不更新统计数据
    this.loadReservations(status, this.data.currentDate);
  },

  // 数据管理方法
  cleanExpiredData() {
    const db = wx.cloud.database();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    db.collection('reservations')
      .where({
        date: db.command.lt(today.toISOString().split('T')[0])
      })
      .remove()
      .then(() => {
        console.log('过期数据清理完成');
        this.loadReservations(this.data.filterStatus, this.data.currentDate);
      })
      .catch(err => {
        console.error('清理过期数据失败：', err);
      });
  },

  handleClearData() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有预约数据吗？此操作不可恢复！',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...',
            mask: true
          });
          
          wx.cloud.callFunction({
            name: 'clearAllData',
            success: res => {
              wx.hideLoading();
              wx.showToast({
                title: '数据已清空',
                icon: 'success'
              });
              // 重新加载数据并重置统计
              this.setData({
                reservations: [],
                totalCount: 0,
                upcomingCount: 0,
                ongoingCount: 0,
                completedCount: 0
              });
            },
            fail: err => {
              wx.hideLoading();
              console.error('清空数据失败：', err);
              wx.showToast({
                title: '清空失败',
                icon: 'error'
              });
            }
          });
        }
      }
    });
  }
});