import './handlers/auth'
import './handlers/user'
import './handlers/role'
import './handlers/menu'
import './handlers/dept'
import './handlers/dict'
import './handlers/log'
import './handlers/deco'
import './handlers/upload'
import { syncMockData } from './db'

export { defineMock, mockRequest, MockError } from './adapter'
export type { MockContext } from './adapter'

syncMockData()
