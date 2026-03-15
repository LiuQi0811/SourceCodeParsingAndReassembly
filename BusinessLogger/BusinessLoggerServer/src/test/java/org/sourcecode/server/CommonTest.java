package org.sourcecode.server;


import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.sourcecode.server.service.ICommonService;

/**
 * @ClassName CommonTest
 * @Description CommonTest
 * @Author LiuQi
 */
public class CommonTest extends BaseTest{
    @Resource
    private ICommonService commonService;
    @Test
    public void logout(){
        commonService.logout("维尼熊 ");
    }
}
