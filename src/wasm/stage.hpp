#include "BVH.hpp"

struct Models{
    ModelBVH bvh;
    std::array<int,16> dir;
    std::array<int,16> dirinv;
};

//複数のモデルとレイの当たり判定をする関数のクラス
class Stage{

    private:
    std::vector<Models> models;
    std::vector<bool> active;

    public:
    /*void construct(void){
        models.clear();
        active.clear();
    }*/

    //頂点情報をv、ポリゴン情報をp、テクスチャ情報をt、モデルの回転拡大平行移動をd(の逆行列)としてステージに追加し、インデックスを返す
    int add(std::vector<vert> v,std::vector<std::array<int,3>> p,std::vector<tri3> t,std::array<int,16> d,std::array<int,16> di){
        int n = models.size();
        models.resize(n+1);
        active.resize(n+1);

        models[n].bvh.construct(v,p,t);
        models[n].dir = d;
        models[n].dirinv = di;
        active[n] = true;

        return n;
    }

    //与えられたインデックスのモデルの当たり判定を無効にする
    void deactivate(int index){
        active[index] = false;
    }

    //与えられたインデックスのモデルの当たり判定を有効にする
    void activate(int index){
        active[index] = true;
    }

    //与えられた光線とモデルたちの当たり判定をする
    rayHit intersectStage(point3 o,vec3 d){
        rayHit ret = {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
        double length = INFF;

        for(int i=0;i<(int)models.size();i++){
            if(!active[i])continue;

            point3 ot = {
                models[i].dirinv[0]*o.x + models[i].dirinv[4]*o.y + models[i].dirinv[8]*o.z + models[i].dirinv[12],
                models[i].dirinv[1]*o.x + models[i].dirinv[5]*o.y + models[i].dirinv[9]*o.z + models[i].dirinv[13],
                models[i].dirinv[2]*o.x + models[i].dirinv[6]*o.y + models[i].dirinv[10]*o.z + models[i].dirinv[14],
            };

            vec3 dt = {
                models[i].dirinv[0]*d.x + models[i].dirinv[4]*d.y + models[i].dirinv[8]*d.z,
                models[i].dirinv[1]*d.x + models[i].dirinv[5]*d.y + models[i].dirinv[9]*d.z,
                models[i].dirinv[2]*d.x + models[i].dirinv[6]*d.y + models[i].dirinv[10]*d.z,
            };

            dt = normalize(dt);
            rayHit r = models[i].bvh.intersectModel(ot,dt);

            if(!r.isHit)continue;
            double dx = r.point.x-ot.x,dy = r.point.y-ot.y,dz = r.point.z-ot.z;
            double rleng = sqrt(dx*dx+dy*dy+dz*dz);
            if(!ret.isHit || rleng < length){
                ret = {
                    r.isHit,
                    {
                        models[i].dir[0]*r.point.x + models[i].dir[4]*r.point.y + models[i].dir[8]*r.point.z + models[i].dir[12],
                        models[i].dir[1]*r.point.x + models[i].dir[5]*r.point.y + models[i].dir[9]*r.point.z + models[i].dir[13],
                        models[i].dir[2]*r.point.x + models[i].dir[6]*r.point.y + models[i].dir[10]*r.point.z + models[i].dir[14],
                    },
                    r.index,
                    normalize({
                        models[i].dir[0]*r.normal.x + models[i].dir[4]*r.normal.y + models[i].dir[8]*r.normal.z,
                        models[i].dir[1]*r.normal.x + models[i].dir[5]*r.normal.y + models[i].dir[9]*r.normal.z,
                        models[i].dir[2]*r.normal.x + models[i].dir[6]*r.normal.y + models[i].dir[10]*r.normal.z,
                    }),
                    r.u,
                    r.v,
                    r.texcoord
                };
                length = rleng;
            }

        }

        return ret;
    }

};