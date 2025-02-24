Page({
    data: {
      password: ''
    },
  
    onPasswordInput(e) {
      this.setData({
        password: e.detail.value
      });
    },
  
    onLogin() {
      // 这里使用一个简单的密码验证，实际应用中应该使用更安全的方式
      if (this.data.password === 'admin123') {
        wx.setStorageSync('isAdmin', true);
        wx.navigateTo({
          url: '/pages/admin/dashboard'
        });
      } else {
        wx.showToast({
          title: '密码错误',
          icon: 'none'
        });
      }
    }
  });