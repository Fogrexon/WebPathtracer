#ifndef SIMPLEINTERSECT_HPP
#define SIMPLEINTERSECT_HPP

#include <vector>
#include <array>
#include <tuple>
#include <cassert>
#include <algorithm>
#include <cmath>

#define INF 2305843009213693951
#define EPS 1e-20
const double INFF = 1e300;

struct point3{
    double x;
    double y;
    double z;
};

struct vec3{
    double x;
    double y;
    double z;
};

struct tri3{
    std::array<point3,3> vertex;
};

struct texpoint{
    double x;
    double y;
};

struct rayHit{
    bool isHit;
    point3 point;
    int index;
    vec3 normal;
    double u;
    double v;
    texpoint texcoord;
};

//3次元正方行列[a,b,c]の行列式をSarrusの方法で求める
//TODO:誤差にやさしい形式で実装したい
double determinant(vec3 a, vec3 b, vec3 c){
    return a.x*b.y*c.z + a.y*b.z*c.x + a.z*b.x*c.y - a.z*b.y*c.x - a.y*b.x*c.z - a.x*b.z*c.y; 
}

//与えられた2つの3次元ベクトルのクロス積を計算する
vec3 crossProduct(vec3 a,vec3 b){
    return {
        a.y*b.z-a.z*b.y,
        a.z*b.x-a.x*b.z,
        a.x*b.y-a.y*b.x
    };
}

//ベクトルを正規化する
vec3 normalize(vec3 v) {
    double len = sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if(len==0)return {0,0,0};

    vec3 norm;
    norm.x = v.x / len;
    norm.y = v.y / len;
    norm.z = v.z / len;

  return norm;
}

//与えられた三角形の法線ベクトルを求める
vec3 normalVector(tri3 T) {
    vec3 u = {T.vertex[1].x-T.vertex[0].x,T.vertex[1].y-T.vertex[0].y,T.vertex[1].z-T.vertex[0].z};
    vec3 v = {T.vertex[2].x-T.vertex[0].x,T.vertex[2].y-T.vertex[0].y,T.vertex[2].z-T.vertex[0].z};
    return normalize(crossProduct(u,v));
}

//rayの始点oと向きd、三角形Tを与えると、Tの内部または境界にrayが
//当たるかを判定し、当たらないならfalseを、当たるならtrueとそのポイントを返す
rayHit intersectTriangle(point3 o,vec3 d,tri3 T){

    //point3 v0 = T[0],v1 = T[1],v2 = T[2];
    point3 v0 = T.vertex[0],v1 = T.vertex[1],v2 = T.vertex[2];
    vec3 r = {o.x-v0.x,o.y-v0.y,o.z-v0.z};
    vec3 e1 = {v1.x-v0.x,v1.y-v0.y,v1.z-v0.z};
    vec3 e2 = {v2.x-v0.x,v2.y-v0.y,v2.z-v0.z};

    double det = determinant(d,e2,e1);
    if(std::abs(det) < EPS){
        return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF}};
    }

    double f = 1/det;

    double t = f * determinant(r,e1,e2);
    double u = f * determinant(d,e2,r);
    double v = f * determinant(r,e1,d);

    if(t<0 || u<0 || v<0 || u+v>1){
        return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF}};
    }

    return {
        true,
        {o.x+t*d.x, o.y+t*d.y, o.z+t*d.z},
        -1,
        normalVector(T),
        u,
        v,
        {INFF,INFF}
    };
}

//rayの始点oと向きd、p,qを対角線上にもつ直方体Bを与えると、Bの内部(または境界)にrayが
//当たるかを判定し、当たらないならfalseを、当たるならtrueとそのポイントを返す
std::pair<bool,point3> intersectBox(point3 o,vec3 d,point3 p,point3 q){
    
    if(p.x>q.x)std::swap(p.x,q.x);
    if(p.y>q.y)std::swap(p.y,q.y);
    if(p.z>q.z)std::swap(p.z,q.z);

    double tM = INFF,tm = -INFF;
    if(d.x==0.0){
        if(!(p.x <= o.x && o.x <= q.x)){
            tM = -INFF;tm=INFF;
        }
    }else{
        tM = std::min(tM,std::max((p.x-o.x)/d.x,(q.x-o.x)/d.x));
        tm = std::max(tm,std::min((p.x-o.x)/d.x,(q.x-o.x)/d.x));
    }

    if(d.y==0.0){
        if(!(p.y <= o.y && o.y <= q.y)){
            tM = -INFF;tm=INFF;
        }
    }else{
        tM = std::min(tM,std::max((p.y-o.y)/d.y,(q.y-o.y)/d.y));
        tm = std::max(tm,std::min((p.y-o.y)/d.y,(q.y-o.y)/d.y));
    }
    
    if(d.z==0.0){
        if(!(p.z <= o.z && o.z <= q.z)){
            tM = -INFF;tm=INFF;
        }
    }else{
        tM = std::min(tM,std::max((p.z-o.z)/d.z,(q.z-o.z)/d.z));
        tm = std::max(tm,std::min((p.z-o.z)/d.z,(q.z-o.z)/d.z));
    }

    if(tm > tM || tM < 0 || (d.x==0.0 && d.y==0.0 && d.z==0.0)){
        return {false,{INFF,INFF,INFF}};
    }
    
    point3 h;
    if(tm>=0){
        h = {o.x+tm*d.x, o.y+tm*d.y, o.z+tm*d.z};
    }else{
        h = {o.x+tM*d.x, o.y+tM*d.y, o.z+tM*d.z};
    }

    return {true,h};

}

#endif