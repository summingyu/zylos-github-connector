/**
 * 测试工具函数库
 *
 * 提供 webhook 测试常用的辅助函数
 */

import crypto from 'crypto';

/**
 * GitHub webhook 事件类型
 */
export const GITHUB_EVENTS = {
  PUSH: 'push',
  PULL_REQUEST: 'pull_request',
  ISSUES: 'issues',
  ISSUE_COMMENT: 'issue_comment',
  RELEASE: 'release',
  PING: 'ping'
};

/**
 * 生成测试用的 webhook 负载
 *
 * @param {string} eventType - GitHub 事件类型
 * @param {object} overrides - 覆盖默认负载的字段
 * @returns {object} GitHub webhook 负载
 */
export function generateTestPayload(eventType = GITHUB_EVENTS.PUSH, overrides = {}) {
  const basePayload = {
    action: 'created',
    repository: {
      id: 123456789,
      name: 'test-repo',
      full_name: 'test-owner/test-repo',
      owner: {
        login: 'test-owner',
        id: 987654321
      },
      private: false,
      html_url: 'https://github.com/test-owner/test-repo',
      description: 'Test repository'
    },
    sender: {
      login: 'test-user',
      id: 111222333,
      type: 'User'
    },
    installation: {
      id: 444555666
    }
  };

  // 根据事件类型添加特定字段
  const eventSpecific = {
    push: {
      ref: 'refs/heads/main',
      before: '0000000000000000000000000000000000000000',
      after: 'abc123def4567890123456789012345678901234',
      pusher: {
        name: 'test-user',
        email: 'test-user@example.com'
      },
      commits: [
        {
          id: 'abc123def4567890123456789012345678901234',
          message: 'Test commit',
          timestamp: new Date().toISOString(),
          author: {
            name: 'test-user',
            email: 'test-user@example.com'
          }
        }
      ]
    },
    pull_request: {
      action: 'opened',
      number: 42,
      pull_request: {
        id: 111222333,
        number: 42,
        title: 'Test PR',
        body: 'Test PR body',
        state: 'open',
        user: {
          login: 'test-user',
          id: 111222333
        },
        head: {
          ref: 'feature-branch',
          sha: 'def4567890123456789012345678901234567890'
        },
        base: {
          ref: 'main',
          sha: 'abc123def4567890123456789012345678901234'
        }
      }
    },
    issues: {
      action: 'opened',
      issue: {
        id: 222333444,
        number: 13,
        title: 'Test issue',
        body: 'Test issue body',
        state: 'open',
        user: {
          login: 'test-user',
          id: 111222333
        }
      }
    },
    issue_comment: {
      action: 'created',
      issue: {
        id: 222333444,
        number: 13,
        title: 'Test issue'
      },
      comment: {
        id: 333444555,
        body: 'Test comment',
        user: {
          login: 'test-user',
          id: 111222333
        }
      }
    },
    release: {
      action: 'published',
      release: {
        id: 444555666,
        tag_name: 'v1.0.0',
        name: 'Test Release',
        body: 'Test release body',
        author: {
          login: 'test-user',
          id: 111222333
        }
      }
    },
    ping: {
      zen: 'Keep it simple, stupid.',
      hook_id: 777888999
    }
  };

  return { ...basePayload, ...eventSpecific[eventType], ...overrides };
}

/**
 * 计算 HMAC-SHA256 签名
 *
 * @param {string|Buffer} payload - 请求负载
 * @param {string} secret - Webhook secret
 * @returns {string} 带有 'sha256=' 前缀的签名
 */
export function computeSignature(payload, secret) {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(buffer);
  return 'sha256=' + hmac.digest('hex');
}

/**
 * 生成测试用的 delivery ID
 *
 * @param {string} prefix - ID 前缀
 * @returns {string} delivery ID
 */
export function generateDeliveryId(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * 发送 HTTP 请求
 *
 * @param {object} options - 请求选项
 * @param {string} options.url - 服务器 URL
 * @param {string} options.method - HTTP 方法
 * @param {object} options.headers - 请求头
 * @param {string|Buffer} options.body - 请求体
 * @returns {Promise<object>} 响应对象
 */
export async function sendRequest({ url, method = 'POST', headers = {}, body = '' }) {
  const urlObj = new URL(url);
  const requestOptions = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: {
      ...headers,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const http = urlObj.protocol === 'https:' ? require('https') : require('http');
    const req = http.request(requestOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 发送测试 webhook 请求
 *
 * @param {object} options - 测试选项
 * @param {string} options.url - 服务器 URL
 * @param {string} options.secret - Webhook secret
 * @param {string} options.eventType - 事件类型
 * @param {object} options.payloadOverrides - 负载覆盖
 * @param {string} options.deliveryId - delivery ID
 * @returns {Promise<object>} 响应对象
 */
export async function sendTestWebhook({
  url = 'http://localhost:3461/webhook',
  secret = 'test-webhook-secret',
  eventType = GITHUB_EVENTS.PUSH,
  payloadOverrides = {},
  deliveryId = null
}) {
  const payload = generateTestPayload(eventType, payloadOverrides);
  const payloadStr = JSON.stringify(payload);
  const signature = computeSignature(payloadStr, secret);

  const headers = {
    'Content-Type': 'application/json',
    'X-GitHub-Event': eventType,
    'X-GitHub-Delivery': deliveryId || generateDeliveryId(),
    'X-Hub-Signature-256': signature
  };

  return sendRequest({ url, method: 'POST', headers, body: payloadStr });
}

/**
 * 测试结果汇总
 */
export class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * 添加测试结果
   */
  add(name, passed, details = '') {
    const result = { name, passed, details };
    this.tests.push(result);
    if (passed) {
      this.passed++;
    } else {
      this.failed++;
    }
  }

  /**
   * 打印结果
   */
  print() {
    console.log('\n测试结果汇总:\n');

    this.tests.forEach((test, index) => {
      const icon = test.passed ? '✓' : '✗';
      console.log(`${icon} 测试 ${index + 1}: ${test.name}`);
      if (test.details) {
        console.log(`  ${test.details}`);
      }
    });

    console.log(`\n总计: ${this.tests.length} 个测试`);
    console.log(`通过: ${this.passed}`);
    console.log(`失败: ${this.failed}`);

    if (this.failed === 0) {
      console.log('\n✅ 所有测试通过！');
    } else {
      console.log('\n❌ 部分测试失败');
    }
  }

  /**
   * 获取退出码
   */
  getExitCode() {
    return this.failed === 0 ? 0 : 1;
  }
}

/**
 * 格式化测试用例名称
 */
export function formatTestCaseName(category, description) {
  return `[${category}] ${description}`;
}

/**
 * 断言助手
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

/**
 * 断言状态码
 */
export function assertStatusCode(actual, expected, description = '') {
  if (actual !== expected) {
    throw new Error(
      `状态码不匹配: ${description}\n` +
      `  预期: ${expected}\n` +
      `  实际: ${actual}`
    );
  }
}

/**
 * 断言响应头
 */
export function assertHeader(headers, name, expected, description = '') {
  const actual = headers[name.toLowerCase()];
  if (actual !== expected) {
    throw new Error(
      `响应头不匹配: ${description}\n` +
      `  ${name}: 预期 "${expected}", 实际 "${actual}"`
    );
  }
}
