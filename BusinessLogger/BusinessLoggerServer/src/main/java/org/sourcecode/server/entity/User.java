package org.sourcecode.server.entity;


import org.sourcecode.toolkit.starter.annotation.DiffLoggerAllFields;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerField;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerIgnore;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * @ClassName User
 * @Description User
 * @Author LiuQi
 */
@DiffLoggerAllFields
public class User {
    private Long id;
    private String name;
    @DiffLoggerIgnore
    private Integer age;
    @DiffLoggerField(name = "性别", function = "SEX")
    private String sex;

    private Address address;
    @DiffLoggerIgnore
    private List<String> likeList;
    private List<String> noLikeList;
    @DiffLoggerIgnore
    private List<Address> testList;
    @DiffLoggerIgnore
    private String[] likeStrings;
    private String[] noLikeStrings;
    private LocalDateTime localDateTime;
    private LocalDate localDate;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public Address getAddress() {
        return address;
    }

    public void setAddress(Address address) {
        this.address = address;
    }

    public List<String> getLikeList() {
        return likeList;
    }

    public void setLikeList(List<String> likeList) {
        this.likeList = likeList;
    }

    public List<String> getNoLikeList() {
        return noLikeList;
    }

    public void setNoLikeList(List<String> noLikeList) {
        this.noLikeList = noLikeList;
    }

    public List<Address> getTestList() {
        return testList;
    }

    public void setTestList(List<Address> testList) {
        this.testList = testList;
    }

    public String[] getLikeStrings() {
        return likeStrings;
    }

    public void setLikeStrings(String[] likeStrings) {
        this.likeStrings = likeStrings;
    }

    public String[] getNoLikeStrings() {
        return noLikeStrings;
    }

    public void setNoLikeStrings(String[] noLikeStrings) {
        this.noLikeStrings = noLikeStrings;
    }

    public LocalDateTime getLocalDateTime() {
        return localDateTime;
    }

    public void setLocalDateTime(LocalDateTime localDateTime) {
        this.localDateTime = localDateTime;
    }

    public LocalDate getLocalDate() {
        return localDate;
    }

    public void setLocalDate(LocalDate localDate) {
        this.localDate = localDate;
    }

    public static class Address {
        private String provinceName;
        private String cityName;
        private String areaName;

        public String getProvinceName() {
            return provinceName;
        }

        public void setProvinceName(String provinceName) {
            this.provinceName = provinceName;
        }

        public String getCityName() {
            return cityName;
        }

        public void setCityName(String cityName) {
            this.cityName = cityName;
        }

        public String getAreaName() {
            return areaName;
        }

        public void setAreaName(String areaName) {
            this.areaName = areaName;
        }
    }
}
