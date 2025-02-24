App({
    globalData: {
      isAdmin: false,  // 管理员登录状态
      userOpenId: '',  // 用户的openid
      currentDate: new Date().toISOString().split('T')[0]  // 当前选中日期，默认今天
    },
    onLaunch() {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: 'cloudbase-0g0feipy52be01ff',  // 使用你的云环境ID
          traceUser: true
        });
      }
      
      // 检查管理员登录状态
      this.globalData.isAdmin = wx.getStorageSync('adminLoggedIn') || false;
    }
  }); 