App({
    globalData: {
    },
    onLaunch() {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: 'cloudbase-0g0feipy52be01ff',  // 这里填写你的云环境ID
          traceUser: true
        });
      }
    }
  }); 