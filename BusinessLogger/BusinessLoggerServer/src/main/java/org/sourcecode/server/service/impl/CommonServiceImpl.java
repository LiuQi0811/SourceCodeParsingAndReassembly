package org.sourcecode.server.service.impl;


import org.sourcecode.server.service.ICommonService;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.springframework.stereotype.Service;

/**
 * @ClassName CommonServiceImpl
 * @Description CommonServiceImpl
 * @Author LiuQi
 */
@Service
public class CommonServiceImpl implements ICommonService {
    @Override
    @LoggerRecord(success = "{{#nickName}}退出成功",type = "AUTH",bizNo = "")
    public void logout(String nickName) {

    }
}
