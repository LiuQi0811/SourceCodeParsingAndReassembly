package org.sourcecode.server;


import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.stereotype.Component;

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
