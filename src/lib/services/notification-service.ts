interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

class NotificationService {
  private permission: NotificationPermission = 'default';

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    return this.permission;
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    });

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds (unless requireInteraction is true)
    if (!options.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  async notifyTaskComplete(task: {
    task_type: string;
    status: string;
    agent_name?: string;
    contact_name?: string;
  }): Promise<void> {
    const statusText = task.status === 'completed' ? 'completed' : 'failed';
    const emoji = task.status === 'completed' ? '✅' : '❌';
    const taskTypeText = task.task_type.replace(/_/g, ' ');
    
    // Build notification body with contact context if available
    let body = `${task.agent_name || 'Agent'} ${statusText} ${taskTypeText}`;
    if (task.contact_name) {
      body = `${task.contact_name}: ${body}`;
    }
    
    await this.showNotification({
      title: `${emoji} Agent Task ${statusText}`,
      body,
      tag: `task-${task.status}`,
      requireInteraction: task.status === 'failed',
    });
  }

  async notifyTaskAssigned(task: {
    task_type: string;
    agent_name?: string;
  }): Promise<void> {
    await this.showNotification({
      title: '🤖 Task Assigned',
      body: `${task.agent_name || 'Agent'} will process ${task.task_type.replace('_', ' ')}`,
      tag: 'task-assigned',
    });
  }
}

export const notificationService = new NotificationService();

