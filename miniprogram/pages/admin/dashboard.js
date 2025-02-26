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
      
      // 主动更新所有预约状态
      this.updateAllReservationStatus();
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
      // 对于部分完成状态的特殊处理
      if (status === 'partially_completed') {
        query.status = status;
      } else {
        query.status = status;
      }
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
          // 保存原始状态，用于比较是否需要更新数据库
          reservation._originalStatus = reservation.status;
          
          // 如果已取消或缺席，保持状态
          if (reservation.status === 'cancelled' || reservation.status === 'absent') {
            return reservation;
          }
          
          // 解析预约日期和时间
          const [date, timeSlots] = [reservation.date, reservation.timeSlots];
          const today = now.toISOString().split('T')[0];
          
          // 如果不是今天的预约，根据日期判断状态
          if (date !== today) {
            if (date < today) {
              reservation.status = 'completed'; // 过去日期，已完成
            } else {
              reservation.status = 'upcoming'; // 未来日期，待完成
            }
            return reservation;
          }
          
          // 处理今天的预约，检查每个时间段
          const slotStatuses = timeSlots.map(slot => {
            const [startStr, endStr] = slot.split('-');
            const startTime = new Date(`${date} ${startStr}`);
            const endTime = new Date(`${date} ${endStr}`);
            
            if (now < startTime) {
              return 'upcoming'; // 未开始
            } else if (now >= startTime && now < endTime) {
              return 'ongoing'; // 进行中
            } else {
              return 'completed'; // 已完成
            }
          });
          
          // 判断整体状态
          if (slotStatuses.includes('ongoing')) {
            reservation.status = 'ongoing'; // 只要有一个时间段在进行中，整体就是进行中
          } else if (slotStatuses.every(status => status === 'completed')) {
            reservation.status = 'completed'; // 所有时间段都已完成
          } else {
            // 混合状态，有已完成和待完成
            const hasCompleted = slotStatuses.includes('completed');
            const hasUpcoming = slotStatuses.includes('upcoming');
            
            if (hasCompleted && hasUpcoming) {
              reservation.statusDisplay = '部分完成'; // 显示文本
              reservation.status = 'partially_completed'; // 状态值
            } else {
              reservation.status = 'upcoming'; // 默认为待完成
            }
          }
          
          return reservation;
        });

        // 更新数据库中的状态
        updatedReservations.forEach(reservation => {
          if (reservation._id && reservation.status !== reservation._originalStatus) {
            console.log('更新预约状态:', reservation._id, '从', reservation._originalStatus, '到', reservation.status);
            db.collection('reservations').doc(reservation._id).update({
              data: {
                status: reservation.status,
                statusDisplay: reservation.statusDisplay || null
              }
            }).then(() => {
              console.log('预约状态更新成功:', reservation._id);
            }).catch(err => {
              console.error('更新预约状态失败：', err);
            });
          }
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
              // 重新加载数据
              this.loadReservations(this.data.filterStatus, this.data.currentDate);
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

  // 标记缺席
  markAsAbsent(e) {
    const id = e.currentTarget.dataset.id;
    const openid = e.currentTarget.dataset.openid;
    const name = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认操作',
      content: '确定要将该预约标记为缺席吗？',
      success: res => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('reservations').doc(id).update({
            data: {
              status: 'absent',
              absentTime: db.serverDate()
            },
            success: () => {
              wx.showToast({
                title: '已标记缺席',
                icon: 'success'
              });
              
              // 检查并更新缺席用户限制
              this.checkAbsentCount(openid, name);
              
              // 重新加载预约列表
              this.loadReservations(this.data.filterStatus, this.data.currentDate);
            }
          });
        }
      }
    });
  },

  // 检查缺席次数
  checkAbsentCount(openid, name) {
    const db = wx.cloud.database();
    const _ = db.command;
    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    
    db.collection('reservations')
      .where({
        _openid: openid,
        status: 'absent',
        absentTime: _.gte(threeMonthsAgo)
      })
      .count()
      .then(res => {
        if (res.total >= 3) {
          // 添加到限制名单
          db.collection('restrictedUsers').add({
            data: {
              openid: openid,
              name: name,
              restrictStartTime: new Date(),
              restrictEndTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 一个月后
              absentCount: res.total
            },
            success: () => {
              console.log('用户已添加到限制名单');
              wx.showToast({
                title: '已限制预约',
                icon: 'success'
              });
            },
            fail: err => {
              console.error('添加限制失败:', err);
              // 如果是因为集合不存在，先创建集合（实际上，添加记录时会自动创建集合）
              console.log('首次创建限制记录，可能需要在云开发控制台检查权限设置');
            }
          });
        }
      });
  },

  // 跳转到缺席记录页面
  navigateToAbsentRecords() {
    wx.navigateTo({
      url: '/pages/admin/absentRecords/absentRecords'
    });
  },

  // 更新所有预约状态
  updateAllReservationStatus() {
    const db = wx.cloud.database();
    const now = new Date();
    console.log('开始更新所有预约状态，当前时间:', now.toLocaleString());
    
    // 使用云函数来更新状态，绕过客户端权限限制
    wx.cloud.callFunction({
      name: 'updateReservationStatus',
      data: {},
      success: res => {
        console.log('云函数更新状态成功:', res);
        // 重新加载数据
        this.loadReservations(this.data.filterStatus, this.data.currentDate);
      },
      fail: err => {
        console.error('云函数更新状态失败:', err);
      }
    });
  },

  // 处理滑动开始
  handleTouchStart(e) {
    this.startX = e.touches[0].pageX;
    this.startY = e.touches[0].pageY;
    this.touchIndex = e.currentTarget.dataset.index;
  },

  // 处理滑动过程
  handleTouchMove(e) {
    if (!this.startX) return;
    
    const currentX = e.touches[0].pageX;
    const currentY = e.touches[0].pageY;
    
    // 计算X和Y方向的滑动距离
    const deltaX = this.startX - currentX;
    const deltaY = Math.abs(this.startY - currentY);
    
    // 如果Y方向滑动距离过大，认为是上下滚动，不触发左右滑动
    if (deltaY > 30) return;
    
    // 阻止页面滚动
    if (Math.abs(deltaX) > 15) {
      e.preventDefault && e.preventDefault();
    }
    
    const index = this.touchIndex;
    if (index === undefined) return;
    
    const reservations = this.data.reservations;
    
    // 向左滑动超过50px时显示操作按钮
    if (deltaX > 50) {
      // 先关闭所有其他项的操作按钮
      reservations.forEach((item, i) => {
        if (i !== index) {
          item.showActions = false;
        }
      });
      
      // 显示当前项的操作按钮
      if (!reservations[index].showActions) {
        reservations[index].showActions = true;
        this.setData({ reservations });
      }
    } 
    // 向右滑动超过30px时隐藏操作按钮
    else if (deltaX < -30) {
      if (reservations[index].showActions) {
        reservations[index].showActions = false;
        this.setData({ reservations });
      }
    }
  },

  // 处理滑动结束
  handleTouchEnd(e) {
    this.startX = 0;
    this.startY = 0;
  }
});