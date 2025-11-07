package org.sourcecode.server;


import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan;

/**
 * @ClassName BaseTest
 * @Description BaseTest
 * @Author LiuQi
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE,classes = BaseTest.Application.class)
public abstract class BaseTest {

    @ComponentScan
    public static class Application{

    }
}
