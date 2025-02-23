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
      filterStatus: 'all', // all, upcoming, completed, cancelled
      upcomingCount: 0,
      completedCount: 0,
      totalCount: 0
    },
  
    onLoad: function() {
      this.checkLoginStatus();
      if (this.data.isLoggedIn) {
        this.loadReservations();
      }
      // 每次打开页面时清理过期数据
      this.cleanExpiredData();
    },
  
    onShow() {
      // 每次显示页面时检查登录状态
      const isLoggedIn = wx.getStorageSync('adminLoggedIn') || false;
      this.setData({
        isLoggedIn,
        showLoginModal: !isLoggedIn
      });
  
      if (isLoggedIn) {
        this.initDateList();
        this.loadReservations();
      }
    },
  
    // 切换密码可见性
    togglePasswordVisibility() {
      this.setData({
        showPassword: !this.data.showPassword
      });
    },
  
    // 处理密码输入
    onPasswordInput(e) {
      this.setData({
        password: e.detail.value
      });
    },
  
    // 管理员登录
    handleLogin() {
      const { password } = this.data;
      if (password === 'hjpp12345') {
        // 保存登录状态
        wx.setStorageSync('adminLoggedIn', true);
        
        this.setData({
          isLoggedIn: true,
          showLoginModal: false,
          password: ''
        });
  
        // 加载数据
        this.initDateList();
        this.loadReservations();
  
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
  
    // 退出登录
    handleLogout() {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // 清除登录状态
            wx.removeStorageSync('adminLoggedIn');
            
            this.setData({
              isLoggedIn: false,
              showLoginModal: true,
            });
  
            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            });
          }
        }
      });
    },
  
    // 初始化日期列表
    initDateList() {
      const dates = [];
      const today = new Date();
      
      // 获取最近30天的日期
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
  
    // 加载预约记录
    loadReservations(status = 'all', date = '') {
      const db = wx.cloud.database();
      this.setData({ loading: true });
  
      // 先获取所有预约记录来计算统计数据
      let query = {};
      if (date) {
        query.date = date;
      }
  
      db.collection('reservations')
        .where(query)
        .get({
          success: res => {
            const allReservations = res.data;
            const upcomingCount = allReservations.filter(r => r.status === 'upcoming').length;
            const completedCount = allReservations.filter(r => r.status === 'completed').length;
            
            this.setData({
              upcomingCount,
              completedCount,
              totalCount: allReservations.length
            });
          }
        });
  
      // 构建查询条件
      if (status !== 'all') {
        query.status = status;
      }
      if (date) {
        query.date = date;
      }
  
      // 获取筛选后的预约记录
      db.collection('reservations')
        .where(query)
        .orderBy('createTime', 'desc')
        .get({
          success: res => {
            console.log('获取到的预约数据：', res.data);
            this.setData({
              reservations: res.data,
              loading: false
            });
          },
          fail: err => {
            console.error('获取数据失败：', err);
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
            this.setData({ loading: false });
          }
        });
    },
  
    // 日期选择
    onDateChange(e) {
      this.setData({
        currentDate: e.detail.value
      });
      this.loadReservations(this.data.filterStatus, e.detail.value);
    },
  
    // 状态筛选
    onStatusChange(e) {
      const status = e.currentTarget.dataset.status;
      this.setData({
        filterStatus: status
      });
      this.loadReservations(status, this.data.currentDate);
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
              success: res => {
                this.loadReservations();
                wx.showToast({
                  title: '取消成功',
                  icon: 'success'
                });
              },
              fail: err => {
                console.error('取消失败：', err);
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
  
    checkLoginStatus() {
      // Implementation of checkLoginStatus method
    },
  
    // 清理过期数据
    cleanExpiredData() {
      const db = wx.cloud.database();
      const _ = db.command;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      db.collection('reservations')
        .where({
          date: _.lt(today.toISOString().split('T')[0])
        })
        .remove({
          success: res => {
            console.log('清理过期数据成功：', res);
            // 重新加载数据
            this.loadReservations(this.data.filterStatus, this.data.currentDate);
          },
          fail: err => {
            console.error('清理过期数据失败：', err);
          }
        });
    },
  
    // 清空所有数据
    handleClearData() {
      wx.showModal({
        title: '警告',
        content: '确定要清空所有预约数据吗？此操作不可恢复！',
        success: (res) => {
          if (res.confirm) {
            const db = wx.cloud.database();
            db.collection('reservations')
              .where({
                _id: /.*/  // 匹配所有记录
              })
              .remove({
                success: res => {
                  wx.showToast({
                    title: '数据已清空',
                    icon: 'success'
                  });
                  // 重新加载数据
                  this.loadReservations(this.data.filterStatus, this.data.currentDate);
                },
                fail: err => {
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