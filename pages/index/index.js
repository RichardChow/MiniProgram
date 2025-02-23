import AdminUtil from '../../utils/admin.js';

Page({
    data: {
      bannerImage: '/images/banner.png',
    },
  
    onLoad() {
    },
  
    // 跳转到预约页面
    goToReserve() {
      wx.navigateTo({
        url: '/pages/reserve/reserve'
      });
    },
  
    // 添加跳转方法
    goToAdmin() {
      if (getApp().globalData.isAdmin) {
        wx.navigateTo({
          url: '/pages/admin/dashboard'
        });
      }
    },
  
    // 双击触发管理员登录
    onImageTap() {
      const currentTime = Date.now();
      const lastTapTime = this.lastTapTime;
      
      // 两次点击间隔小于300ms视为双击
      if (currentTime - lastTapTime < 300) {
        if (!this.data.isAdmin) {
          this.setData({
            adminModalVisible: true
          });
        }
      }
      
      this.lastTapTime = currentTime;
    },
  
    // 处理密码输入
    onPasswordInput(e) {
      this.setData({
        password: e.detail.value
      });
    },
  
    // 关闭模态框
    onClose() {
      this.setData({
        adminModalVisible: false,
        password: ''
      });
    },
  
    // 管理员登录
    async handleAdminLogin() {
      const { password } = this.data;
      const correctPassword = 'admin123'; // 实际应用中应该使用加密存储的密码
  
      if (AdminUtil.validatePassword(password, correctPassword)) {
        getApp().globalData.isAdmin = true;
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        
        this.setData({
          isAdmin: true,
          adminModalVisible: false,
          password: ''
        });
  
        // 跳转到管理页面
        wx.navigateTo({
          url: '/pages/admin/dashboard'
        });
      } else {
        wx.showToast({
          title: '密码错误',
          icon: 'error'
        });
      }
    },
  
    // 退出登录
    logout() {
      AdminUtil.logout();
      this.setData({
        isAdmin: false
      });
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      });
    },
  
    // 点击预约须知中的特定文字
    onNoticeClick() {
      this.setData({
        tapCount: this.data.tapCount + 1
      });
  
      if (this.data.tapCount >= 5) {  // 连续点击5次触发
        this.setData({
          adminModalVisible: true,
          tapCount: 0
        });
      }
    },
  
    showAdminLogin() {
      if (!this.data.isAdmin) {
        this.setData({
          adminModalVisible: true
        });
      }
    },
  
    submitReservation() {
      const db = wx.cloud.database();
      db.collection('reservations').add({
        data: {
          name: this.data.name,
          phone: this.data.phone,
          date: this.data.selectedDate,
          status: 'upcoming'
        },
        success: res => {
          wx.showToast({
            title: '预约成功',
            icon: 'success'
          });
          this.resetForm();
        },
        fail: err => {
          console.error('预约失败：', err);
          wx.showToast({
            title: '预约失败',
            icon: 'error'
          });
        }
      });
    }
  }); 