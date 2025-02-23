Page({
    data: {
      name: '',
      phone: '',
      hasPartner: false,
      partnerPhone: '',
      date: '',
      minDate: '',
      maxDate: '',
      availableDates: [],
      timeSlots: [
        { time: '09:00-10:00', selected: false, disabled: false },
        { time: '10:00-11:00', selected: false, disabled: false },
        { time: '14:00-15:00', selected: false, disabled: false },
        { time: '15:00-16:00', selected: false, disabled: false },
        { time: '16:00-17:00', selected: false, disabled: false },
        { time: '18:00-19:00', selected: false, disabled: false },
        { time: '19:00-20:00', selected: false, disabled: false }
      ],
      selectedTimeSlots: [],
      partnerOptions: [
        { value: false, name: '否' },
        { value: true, name: '是' }
      ],
    },
  
    onLoad() {
      this.initDateRange();
    },
  
    // 初始化可选日期范围
    initDateRange() {
      const today = new Date();
      const minDate = today.toISOString().split('T')[0];
      const maxDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];
      
      // 生成可选日期数组(排除周一)
      const dates = [];
      let currentDate = new Date();
      for(let i = 0; i < 7; i++) {
        if(currentDate.getDay() !== 1) { // 排除周一
          dates.push(currentDate.toISOString().split('T')[0]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
  
      this.setData({
        minDate,
        maxDate,
        availableDates: dates
      });
    },
  
    // 输入姓名
    onNameInput(e) {
      this.setData({
        name: e.detail.value
      });
    },
  
    // 输入手机号
    onPhoneInput(e) {
      this.setData({
        phone: e.detail.value
      });
    },
  
    // 修改带同伴选择方法
    onPartnerChange(e) {
      this.setData({
        hasPartner: e.detail.value === 'true',
        partnerPhone: '' // 切换时清空同伴手机号
      });
    },
  
    // 新增同伴手机号输入方法
    onPartnerPhoneInput(e) {
      this.setData({
        partnerPhone: e.detail.value
      });
    },
  
    // 检查时间段是否已被预约
    checkTimeSlotAvailability(date, timeSlot) {
      return new Promise((resolve) => {
        const db = wx.cloud.database();
        db.collection('reservations')
          .where({
            date: date,
            status: 'upcoming',
            timeSlots: timeSlot
          })
          .get({
            success: res => {
              resolve(res.data.length === 0);
            },
            fail: err => {
              console.error('查询失败：', err);
              resolve(false);
            }
          });
      });
    },
  
    // 更新时间段状态
    updateTimeSlotsStatus(selectedDate) {
      const today = new Date();
      const selected = new Date(selectedDate);
      const timeSlots = this.data.timeSlots;
      
      // 判断是否是同一天
      const isToday = selected.toDateString() === today.toDateString();
      const currentHour = today.getHours();
      const currentMinutes = today.getMinutes();
  
      // 使用Promise.all处理所有时间段的检查
      Promise.all(timeSlots.map(async (slot) => {
        const [startTime] = slot.time.split('-');
        const [hours] = startTime.split(':').map(Number);
        
        // 重置选中状态
        slot.selected = false;
        
        // 检查时间段是否已被预约
        const isAvailable = await this.checkTimeSlotAvailability(selectedDate, slot.time);
        
        // 如果是今天，检查时间是否已过
        if (isToday) {
          // 如果当前小时已经超过时间段开始时间，或者是同一小时但分钟已过30分，则禁用
          slot.disabled = (currentHour > hours) || 
                         (currentHour === hours && currentMinutes > 30) || 
                         !isAvailable;
        } else {
          slot.disabled = !isAvailable;
        }
  
        // 添加提示信息
        slot.tooltip = !isAvailable ? '已被预约' : 
                      (slot.disabled ? '时间已过' : '可预约');
        return slot;
      })).then(updatedTimeSlots => {
        // 更新UI
        this.setData({
          timeSlots: updatedTimeSlots,
          selectedTimeSlots: []
        });
      });
    },
  
    // 修改选择日期方法
    onDateChange(e) {
      const selectedDate = new Date(e.detail.value);
      if(selectedDate.getDay() === 1) {
        wx.showToast({
          title: '周一闭馆不可预约',
          icon: 'none'
        });
        return;
      }
  
      // 如果选择了新的日期，重置所有时间段状态
      this.setData({
        date: e.detail.value,
        selectedTimeSlots: [] // 清空已选时间段
      });
      
      // 更新时间段状态
      this.updateTimeSlotsStatus(e.detail.value);
    },
  
    // 修改选择时间段方法
    onTimeSlotTap(e) {
      const index = e.currentTarget.dataset.index;
      const timeSlots = this.data.timeSlots;
      
      // 如果时间段已禁用，显示具体原因
      if (timeSlots[index].disabled) {
        wx.showToast({
          title: timeSlots[index].tooltip,
          icon: 'none'
        });
        return;
      }
  
      const selectedCount = timeSlots.filter(slot => slot.selected).length;
  
      if(timeSlots[index].selected) {
        timeSlots[index].selected = false;
      } else if(selectedCount < 2) {
        timeSlots[index].selected = true;
      } else {
        wx.showToast({
          title: '最多选择两个时间段',
          icon: 'none'
        });
        return;
      }
  
      const selectedTimeSlots = timeSlots
        .filter(slot => slot.selected)
        .map(slot => slot.time);
  
      this.setData({
        timeSlots,
        selectedTimeSlots
      });
    },
  
    // 提交预约
    onSubmit() {
      if(!this.validateForm()) {
        return;
      }
  
      // 添加到云数据库
      const db = wx.cloud.database();
      db.collection('reservations').add({
        data: {
          name: this.data.name,
          phone: this.data.phone,
          hasPartner: this.data.hasPartner,
          partnerPhone: this.data.partnerPhone,
          date: this.data.date,
          timeSlots: this.data.selectedTimeSlots,
          createTime: db.serverDate(),
          status: 'upcoming'
        },
        success: res => {
          wx.showToast({
            title: '预约成功',
            icon: 'success'
          });
          this.resetForm();
          // 预约成功后跳转到我的预约页面
          wx.switchTab({
            url: '/pages/records/records'
          });
        },
        fail: err => {
          console.error('预约失败：', err);
          wx.showToast({
            title: '预约失败',
            icon: 'error'
          });
        }
      });
    },
  
    // 表单验证
    validateForm() {
      if(!this.data.name.trim()) {
        wx.showToast({
          title: '请输入姓名',
          icon: 'none'
        });
        return false;
      }
  
      if(!/^1[3-9]\d{9}$/.test(this.data.phone)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return false;
      }
  
      if(!this.data.date) {
        wx.showToast({
          title: '请选择预约日期',
          icon: 'none'
        });
        return false;
      }
  
      if(this.data.selectedTimeSlots.length === 0) {
        wx.showToast({
          title: '请至少选择一个时间段',
          icon: 'none'
        });
        return false;
      }
  
      if(this.data.hasPartner) {
        if(!/^1[3-9]\d{9}$/.test(this.data.partnerPhone)) {
          wx.showToast({
            title: '请输入正确的同伴手机号',
            icon: 'none'
          });
          return false;
        }
      }
  
      return true;
    },
  
    resetForm() {
      this.setData({
        name: '',
        phone: '',
        hasPartner: false,
        partnerPhone: '',
        date: '',
        selectedTimeSlots: [],
        timeSlots: [
          { time: '09:00-10:00', selected: false, disabled: false },
          { time: '10:00-11:00', selected: false, disabled: false },
          { time: '14:00-15:00', selected: false, disabled: false },
          { time: '15:00-16:00', selected: false, disabled: false },
          { time: '16:00-17:00', selected: false, disabled: false },
          { time: '18:00-19:00', selected: false, disabled: false },
          { time: '19:00-20:00', selected: false, disabled: false }
        ]
      });
    }
  }); 